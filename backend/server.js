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

// CORS Configuration - Fixed for your Netlify domain
app.use(cors({
    origin: [
        'https://femacase.netlify.app',  // Your exact Netlify domain
        'https://*.netlify.app',         // All Netlify subdomains
        'http://localhost:3000',
        'http://localhost:8080',
        'http://localhost:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Data storage function
const readJSON = (file) => {
    const filePath = join(__dirname, 'data', file);
    console.log('Reading file:', filePath);
    
    if (!existsSync(filePath)) {
        console.log('File not found:', filePath);
        return [];
    }
    
    try {
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
        console.log(`Loaded ${data.length} records from ${file}`);
        return data;
    } catch (error) {
        console.error('Error reading file:', error);
        return [];
    }
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Auth header:', authHeader);
    console.log('Token:', token ? token.substring(0, 20) + '...' : 'None');

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Token verification failed:', err);
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    console.log('Health check requested');
    res.json({ 
        status: 'Healthy', 
        service: 'FEMA Case Management',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    try {
        console.log('Login attempt:', req.body);
        
        const { case_number, last_name, password } = req.body;

        if (!case_number || !last_name || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const users = readJSON('users.json');
        console.log('Available users:', users.length);

        const user = users.find(u => 
            u.case_number === case_number && 
            u.last_name.toLowerCase() === last_name.toLowerCase()
        );

        if (!user) {
            console.log('User not found:', { case_number, last_name });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.password !== password) {
            console.log('Password mismatch for user:', user.case_number);
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

        console.log('Login successful for:', user.case_number);
        
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

// Dashboard endpoint
app.get('/api/dashboard', authenticateToken, (req, res) => {
    try {
        console.log('Dashboard request for user:', req.user);
        
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
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 12);

        const userPayments = payments
            .filter(p => p.case_number === userCaseNumber)
            .filter(p => {
                try {
                    const paymentDate = new Date(p.payment_date);
                    return paymentDate >= sixMonthsAgo;
                } catch (e) {
                    return false;
                }
            })
            .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
        
        // Get lawyer data
        const lawyers = readJSON('lawyers.json');
        const lawyer = lawyers.find(l => l.case_number === userCaseNumber) || {};

        // Get court visits (last 5)
        const courtVisits = readJSON('court_visits.json')
            .filter(c => c.case_number === userCaseNumber)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        // Calculate progress
        const totalPaid = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const progress = user.total_amount > 0 ? (totalPaid / user.total_amount) * 100 : 0;

        // Prepare response data
        const responseData = {
            user: {
                ...user,
                password: undefined // Remove password
            },
            payments: userPayments,
            lawyer: lawyer,
            court_visits: courtVisits,
            progress: Math.round(progress),
            amount_paid: totalPaid,
            amount_remaining: user.total_amount - totalPaid,
            last_updated: new Date().toISOString()
        };

        console.log('Dashboard data prepared for:', userCaseNumber);
        console.log('Payments found:', userPayments.length);
        console.log('Court visits found:', courtVisits.length);
        
        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard data: ' + error.message });
    }
});

// Verify token endpoint
app.post('/api/verify-token', (req, res) => {
    const { token } = req.body;
    
    console.log('Token verification request');
    
    if (!token) {
        return res.json({ valid: false });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log('Token verification failed:', err);
            return res.json({ valid: false });
        }
        res.json({ valid: true, user: decoded });
    });
});

// Logout endpoint
app.post('/api/logout', authenticateToken, (req, res) => {
    console.log('Logout request for user:', req.user.caseNumber);
    res.json({ success: true, message: 'Logged out successfully' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'FEMA Case Management API',
        version: '1.0.0',
        endpoints: {
            health: 'GET /api/health',
            login: 'POST /api/login',
            dashboard: 'GET /api/dashboard (requires auth)',
            verify_token: 'POST /api/verify-token',
            logout: 'POST /api/logout'
        },
        status: 'operational'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FEMA Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌍 CORS enabled for: https://femacase.netlify.app`);
    console.log(`🔑 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
    console.log(`📊 Available endpoints:`);
    console.log(`   - GET  /api/health`);
    console.log(`   - POST /api/login`);
    console.log(`   - GET  /api/dashboard (protected)`);
    console.log(`   - POST /api/verify-token`);
    console.log(`   - POST /api/logout`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    process.exit(0);
});
