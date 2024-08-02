const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// MySQL connection
const connection = mysql.createConnection({
    //host: 'localhost',
    //user: 'root',
    //password: '',
    //database: 'Graded'
    host: '130.162.54.212',
    user: 'freedb_zhenghong',
    password: 'zjN7X!cN@Q!!S3q',
    database: 'freedb_miniprojectc237'
});

connection.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL');
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public/images', express.static(path.join(__dirname, 'public/images')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'public/images');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.render('index');
});

// User Authentication Routes
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', upload.single('profile_picture'), (req, res) => {
    const { username, email, password } = req.body;
    const profilePicture = req.file ? req.file.filename : null;
    connection.query('INSERT INTO users (username, email, password, profile_picture) VALUES (?, ?, ?, ?)', [username, email, password, profilePicture], (err, results) => {
        if (err) throw err;
        connection.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
            if (err) throw err;
            req.session.loggedin = true;
            req.session.user = { id: results[0].id, email: email, username: username, profile_picture: profilePicture };
            res.redirect('/dashboard');
        });
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    connection.query('SELECT id, username, profile_picture FROM users WHERE email = ? AND password = ?', [email, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.session.loggedin = true;
            req.session.user = results[0];
            res.redirect('/dashboard');
        } else {
            res.send('Incorrect email or password!');
        }
    });
});

app.get('/dashboard', (req, res) => {
    if (req.session.loggedin) {
        res.render('dashboard', { user: req.session.user });
    } else {
        res.send('Please login to view this page!');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Budgets Routes
app.get('/budgets', (req, res) => {
    if (req.session.loggedin) {
        connection.query('SELECT * FROM budgets WHERE user_id = ?', [req.session.user.id], (err, results) => {
            if (err) throw err;
            res.render('budgets', { budgets: results });
        });
    } else {
        res.send('Please login to view this page!');
    }
});

app.post('/budgets', (req, res) => {
    const { category, amount } = req.body;
    const userId = req.session.user.id;
    connection.query('INSERT INTO budgets (user_id, category, amount) VALUES (?, ?, ?)', [userId, category, amount], (err, results) => {
        if (err) throw err;
        res.redirect('/budgets');
    });
});

// Expenses Routes
app.get('/expenses', (req, res) => {
    if (req.session.loggedin) {
        connection.query('SELECT * FROM expenses WHERE user_id = ?', [req.session.user.id], (err, expensesResults) => {
            if (err) throw err;
            connection.query('SELECT * FROM budgets WHERE user_id = ?', [req.session.user.id], (err, budgetsResults) => {
                if (err) throw err;
                res.render('expenses', { expenses: expensesResults, budgets: budgetsResults });
            });
        });
    } else {
        res.send('Please login to view this page!');
    }
});

app.post('/expenses', (req, res) => {
    const { budget_id, description, amount, date } = req.body;
    const userId = req.session.user.id;

    connection.query('SELECT id FROM budgets WHERE id = ? AND user_id = ?', [budget_id, userId], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            const category = 'Uncategorized'; // Assign a default category if needed
            connection.query('INSERT INTO budgets (user_id, category, amount) VALUES (?, ?, 0)', [userId, category], (err, results) => {
                if (err) throw err;
                const newBudgetId = results.insertId;
                addExpense(newBudgetId);
            });
        } else {
            addExpense(budget_id);
        }
    });

    function addExpense(budgetId) {
        connection.query('INSERT INTO expenses (user_id, budget_id, description, amount, date) VALUES (?, ?, ?, ?, ?)', [userId, budgetId, description, amount, date], (err, results) => {
            if (err) throw err;
            res.redirect('/expenses');
        });
    }
});

// Delete expense route
app.post('/expenses/:id/delete', (req, res) => {
    if (req.session.loggedin) {
        const expenseId = req.params.id;
        const userId = req.session.user.id;
        connection.query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [expenseId, userId], (err, results) => {
            if (err) throw err;
            res.redirect('/expenses');
        });
    } else {
        res.send('Please login to view this page!');
    }
});

// Savings Goals Routes
app.get('/savingsGoals', (req, res) => {
    if (req.session.loggedin) {
        connection.query('SELECT * FROM savings_goals WHERE user_id = ?', [req.session.user.id], (err, results) => {
            if (err) throw err;
            res.render('savingsGoals', { goals: results });
        });
    } else {
        res.send('Please login to view this page!');
    }
});

app.post('/savingsGoals', (req, res) => {
    const { goal_name, target_amount, current_amount, target_date } = req.body;
    const userId = req.session.user.id;
    connection.query('INSERT INTO savings_goals (user_id, goal_name, target_amount, current_amount, target_date) VALUES (?, ?, ?, ?, ?)', [userId, goal_name, target_amount, current_amount, target_date], (err, results) => {
        if (err) throw err;
        res.redirect('/savingsGoals');
    });
});

// Bills Routes
app.get('/bills', (req, res) => {
    if (req.session.loggedin) {
        connection.query('SELECT * FROM bills WHERE user_id = ?', [req.session.user.id], (err, results) => {
            if (err) throw err;
            res.render('bills', { bills: results });
        });
    } else {
        res.send('Please login to view this page!');
    }
});

// Update bill route
app.post('/bills/update', (req, res) => {
    connection.query('UPDATE bills SET paid = true WHERE paid = false', (err, results) => {
        if (err) throw err;
        res.redirect('/bills');
    });
});

app.post('/bills', (req, res) => {
    const { bill_name, amount, due_date, paid } = req.body;
    const userId = req.session.user.id;
    const paidValue = paid ? true : false; // Ensure paid is not NULL
    connection.query('INSERT INTO bills (user_id, bill_name, amount, due_date, paid) VALUES (?, ?, ?, ?, ?)', [userId, bill_name, amount, due_date, paidValue], (err, results) => {
        if (err) throw err;
        res.redirect('/bills');
    });
});

// Delete budget route
app.post('/budgets/:id/delete', (req, res) => {
    if (req.session.loggedin) {
        const budgetId = req.params.id;
        const userId = req.session.user.id;
        connection.query('DELETE FROM budgets WHERE id = ? AND user_id = ?', [budgetId, userId], (err, results) => {
            if (err) throw err;
            res.redirect('/budgets');
        });
    } else {
        res.send('Please login to view this page!');
    }
});

// Delete savings goal route
app.post('/savingsGoals/:id/delete', (req, res) => {
    if (req.session.loggedin) {
        const goalId = req.params.id;
        const userId = req.session.user.id;
        connection.query('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, userId], (err, results) => {
            if (err) throw err;
            res.redirect('/savingsGoals');
        });
    } else {
        res.send('Please login to view this page!');
    }
});

// Delete bill route
app.post('/bills/:id/delete', (req, res) => {
    if (req.session.loggedin) {
        const billId = req.params.id;
        const userId = req.session.user.id;
        connection.query('DELETE FROM bills WHERE id = ? AND user_id = ?', [billId, userId], (err, results) => {
            if (err) throw err;
            res.redirect('/bills');
        });
    } else {
        res.send('Please login to view this page!');
    }
});

// About and Contact Routes
app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/contact', (req, res) => {
    res.render('contact');
});

app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    console.log(`Message from ${name} (${email}): ${message}`);
    res.send('Thank you for contacting us! We will get back to you shortly.');
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
