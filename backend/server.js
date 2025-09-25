import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fema_secure_key_2024';

// Enhanced CORS setup
app.use(cors({
    origin: ['femacase.netlify.app', 'http://localhost:3000'],
    credentials: true
}));

app.use(express.json());

// Data loader
const readJSON = (file) => {
    const filePath = join(__dirname, 'data', file);
    if (!existsSync(filePath)) return [];
    return JSON.parse(readFileSync(filePath, 'utf8'));
};

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'Healthy', service: 'FEMA Case Management' });
});

app.post('/api/login', (req, res) => {
    const { case_number, last_name, password } = req.body;
    
    const users = readJSON('users.json');
    const user = users.find(u => u.case_number === case_number && u.last_name === last_name && u.password === password);
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, caseNumber: user.case_number }, JWT_SECRET, { expiresIn: '8h' });
    const { password: _, ...userWithoutPassword } = user;

    res.json({ success: true, token, user: userWithoutPassword });
});

app.get('/api/dashboard', authenticateToken, (req, res) => {
    const userCaseNumber = req.user.caseNumber;
    
    const users = readJSON('users.json');
    const user = users.find(u => u.case_number === userCaseNumber);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const payments = readJSON('payments.json').filter(p => p.case_number === userCaseNumber);
    const lawyers = readJSON('lawyers.json');
    const lawyer = lawyers.find(l => l.case_number === userCaseNumber) || {};
    const courtVisits = readJSON('court_visits.json').filter(c => c.case_number === userCaseNumber).slice(0, 5);

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const progress = user.total_amount > 0 ? (totalPaid / user.total_amount) * 100 : 0;

    res.json({
        success: true,
        data: {
            user: { ...user, password: undefined },
            payments,
            lawyer,
            court_visits: courtVisits,
            progress: Math.round(progress),
            amount_paid: totalPaid,
            amount_remaining: user.total_amount - totalPaid,
            last_updated: new Date().toISOString()
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 FEMA Server running on port ${PORT}`);
});
