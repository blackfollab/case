import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fema_secure_key_2024_production';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Data storage functions
const readJSON = (file) => {
  if (!existsSync(`./data/${file}`)) return [];
  return JSON.parse(readFileSync(`./data/${file}`, 'utf8'));
};

const writeJSON = (file, data) => {
  writeFileSync(`./data/${file}`, JSON.stringify(data, null, 2));
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { case_number, last_name, password } = req.body;

    if (!case_number || !last_name || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Read users from JSON file
    const users = readJSON('users.json');
    const user = users.find(u => 
      u.case_number === case_number && 
      u.last_name.toLowerCase() === last_name.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // In production, we'd use bcrypt.compare for hashed passwords
    // For now, simple comparison (you can add hashing later)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        caseNumber: user.case_number,
        userType: 'client'
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword,
      expiresIn: '8h'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard data
app.get('/api/dashboard', authenticateToken, (req, res) => {
  try {
    const userCaseNumber = req.user.caseNumber;

    // Get user data
    const users = readJSON('users.json');
    const user = users.find(u => u.case_number === userCaseNumber);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get payments (last 6 months)
    const payments = readJSON('payments.json');
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const userPayments = payments
      .filter(p => p.case_number === userCaseNumber)
      .filter(p => new Date(p.payment_date) >= sixMonthsAgo)
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

    // Get lawyer info
    const lawyers = readJSON('lawyers.json');
    const lawyer = lawyers.find(l => l.case_number === userCaseNumber) || {};

    // Calculate progress
    const totalPaid = userPayments.reduce((sum, p) => sum + p.amount, 0);
    const progress = user.total_amount > 0 ? (totalPaid / user.total_amount) * 100 : 0;

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          password: undefined // Remove password from response
        },
        payments: userPayments,
        lawyer,
        progress: Math.round(progress),
        amount_paid: totalPaid,
        amount_remaining: user.total_amount - totalPaid,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Verify token endpoint
app.post('/api/verify-token', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.json({ valid: false });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.json({ valid: false });
    }
    res.json({ valid: true, user: decoded });
  });
});

// Logout endpoint (client-side token removal)
app.post('/api/logout', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

app.listen(PORT, () => {
  console.log(`FEMA Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});