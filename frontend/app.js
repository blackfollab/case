class FEMACaseSystem {
    constructor() {
        this.API_BASE = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api' 
            : 'YOUR_DEPLOYED_BACKEND_URL/api';
        
        this.state = {
            token: null,
            user: null,
            sessionTimer: null
        };
        
        this.init();
    }

    async init() {
        console.log('🚀 FEMA System Initializing...');
        
        // Check for existing session
        await this.checkExistingSession();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Prevent navigation away without warning
        window.addEventListener('beforeunload', (e) => {
            if (this.state.token) {
                e.preventDefault();
                e.returnValue = 'You will be logged out if you leave this page.';
            }
        });
    }

    async checkExistingSession() {
        const savedToken = localStorage.getItem('fema_token');
        const savedUser = localStorage.getItem('fema_user');

        if (savedToken && savedUser) {
            try {
                // Verify token is still valid
                const isValid = await this.verifyToken(savedToken);
                if (isValid) {
                    this.state.token = savedToken;
                    this.state.user = JSON.parse(savedUser);
                    await this.loadDashboard();
                    this.showDashboard();
                    return;
                }
            } catch (error) {
                console.error('Session validation failed:', error);
            }
        }

        // No valid session found
        this.clearSession();
        this.showLogin();
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const caseNumber = document.getElementById('case-number').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const password = document.getElementById('password').value;
        
        if (!this.validateLoginInput(caseNumber, lastName, password)) {
            this.showAlert('Please fill in all fields correctly.', 'danger');
            return;
        }

        this.setLoginButtonState(true);

        try {
            const response = await this.apiCall('/login', 'POST', {
                case_number: caseNumber,
                last_name: lastName,
                password: password
            });

            if (response.success) {
                await this.handleSuccessfulLogin(response);
            } else {
                this.showAlert(response.error || 'Login failed. Please check your credentials.', 'danger');
            }
        } catch (error) {
            this.showAlert('Network error: Please check your connection and try again.', 'danger');
        } finally {
            this.setLoginButtonState(false);
        }
    }

    async handleSuccessfulLogin(response) {
        this.state.token = response.token;
        this.state.user = response.user;
        
        // Store session
        localStorage.setItem('fema_token', response.token);
        localStorage.setItem('fema_user', JSON.stringify(response.user));
        
        // Load dashboard data
        await this.loadDashboard();
        this.showDashboard();
        
        this.showAlert('Login successful!', 'success', 3000);
    }

    async loadDashboard() {
        this.showLoadingState();
        
        try {
            const response = await this.apiCall('/dashboard', 'GET');
            
            if (response.success) {
                this.displayDashboard(response.data);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showAlert('Failed to load dashboard data. Please try logging in again.', 'danger');
            this.logout();
        } finally {
            this.hideLoadingState();
        }
    }

    displayDashboard(data) {
        // Update user welcome message
        document.getElementById('welcome-message').textContent = 
            `Welcome back, ${data.user.first_name}`;

        // Create dashboard HTML
        document.getElementById('dashboard-content').innerHTML = this.generateDashboardHTML(data);
    }

    generateDashboardHTML(data) {
        return `
            <!-- Case Summary -->
            <div class="row mb-4">
                <div class="col-md-4 mb-3">
                    <div class="dashboard-card p-4 text-center">
                        <div class="user-avatar mb-3">
                            <i class="fas fa-user-shield fa-2x text-fema-blue"></i>
                        </div>
                        <h4>${data.user.first_name} ${data.user.last_name}</h4>
                        <p class="text-muted mb-2">${data.user.case_number}</p>
                        <span class="badge bg-success">${data.user.status.toUpperCase()}</span>
                    </div>
                </div>
                
                <div class="col-md-8">
                    <div class="row h-100">
                        <div class="col-6 mb-3">
                            <div class="stat-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-muted mb-1">Total Amount</h6>
                                        <h3 class="mb-0">$${data.user.total_amount.toLocaleString()}</h3>
                                    </div>
                                    <i class="fas fa-dollar-sign fa-2x text-muted"></i>
                                </div>
                            </div>
                        </div>
                        <div class="col-6 mb-3">
                            <div class="stat-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-muted mb-1">Amount Paid</h6>
                                        <h3 class="mb-0 text-success">$${data.amount_paid.toLocaleString()}</h3>
                                    </div>
                                    <i class="fas fa-check-circle fa-2x text-success"></i>
                                </div>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="stat-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-muted mb-1">Amount Remaining</h6>
                                        <h3 class="mb-0 text-warning">$${data.amount_remaining.toLocaleString()}</h3>
                                    </div>
                                    <i class="fas fa-clock fa-2x text-warning"></i>
                                </div>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="stat-card">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-muted mb-1">Completion</h6>
                                        <h3 class="mb-0">${data.progress}%</h3>
                                    </div>
                                    <i class="fas fa-chart-line fa-2x text-primary"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="dashboard-card p-4 mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0">Payment Progress</h5>
                    <span class="badge bg-primary">${data.progress}% Complete</span>
                </div>
                <div class="progress mb-2" style="height: 25px;">
                    <div class="progress-bar" style="width: ${data.progress}%">
                        ${data.progress}%
                    </div>
                </div>
                <small class="text-muted">Based on total settlement amount and verified payments</small>
            </div>

            <!-- Payment History -->
            <div class="dashboard-card p-4 mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0">Payment History</h5>
                    <small class="text-muted">Last 6 months</small>
                </div>
                ${this.generatePaymentsHTML(data.payments)}
            </div>

            <!-- Legal Representative -->
            <div class="dashboard-card p-4">
                <h5 class="mb-3">Assigned Legal Representative</h5>
                ${this.generateLawyerHTML(data.lawyer)}
            </div>

            <!-- System Info -->
            <div class="alert alert-info mt-4">
                <small>
                    <i class="fas fa-info-circle me-2"></i>
                    Last updated: ${new Date(data.last_updated).toLocaleString()} | 
                    Secure FEMA Case Management System
                </small>
            </div>
        `;
    }

    generatePaymentsHTML(payments) {
        if (!payments || payments.length === 0) {
            return `
                <div class="text-center py-4">
                    <i class="fas fa-receipt fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No payment history available for the last 6 months</p>
                </div>
            `;
        }

        return `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Reference ID</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(payment => `
                            <tr>
                                <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                                <td class="fw-semibold">$${payment.amount.toLocaleString()}</td>
                                <td>
                                    <span class="badge ${payment.status === 'completed' ? 'bg-success' : 'bg-warning'}">
                                        ${payment.status}
                                    </span>
                                </td>
                                <td><code>${payment.reference_id}</code></td>
                                <td>${payment.description || 'Payment'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    generateLawyerHTML(lawyer) {
        if (!lawyer || !lawyer.name) {
            return `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No legal representative has been assigned to your case yet.
                </div>
            `;
        }

        return `
            <div class="row">
                <div class="col-md-8">
                    <h6>${lawyer.name}</h6>
                    <p class="text-muted mb-3">FEMA Case Attorney</p>
                    
                    ${lawyer.email ? `
                        <p class="mb-2">
                            <i class="fas fa-envelope me-2 text-muted"></i>
                            <a href="mailto:${lawyer.email}">${lawyer.email}</a>
                        </p>
                    ` : ''}
                    
                    ${lawyer.phone ? `
                        <p class="mb-2">
                            <i class="fas fa-phone me-2 text-muted"></i>
                            ${lawyer.phone}
                        </p>
                    ` : ''}
                    
                    ${lawyer.bar_number ? `
                        <p class="mb-2">
                            <i class="fas fa-id-card me-2 text-muted"></i>
                            Bar Number: ${lawyer.bar_number}
                        </p>
                    ` : ''}
                    
                    ${lawyer.specialization ? `
                        <p class="mb-2">
                            <i class="fas fa-briefcase me-2 text-muted"></i>
                            ${lawyer.specialization}
                        </p>
                    ` : ''}
                </div>
                <div class="col-md-4 text-center">
                    <div class="bg-fema-light rounded p-4">
                        <i class="fas fa-user-tie fa-3x text-fema-blue mb-3"></i>
                        <p class="small text-muted mb-0">Your assigned attorney will contact you regarding case updates</p>
                    </div>
                </div>
            </div>
        `;
    }

    // API Methods
    async apiCall(endpoint, method = 'GET', data = null) {
        const url = this.API_BASE + endpoint;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.state.token) {
            options.headers['Authorization'] = `Bearer ${this.state.token}`;
        }

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    }

    async verifyToken(token) {
        try {
            const response = await this.apiCall('/verify-token', 'POST', { token });
            return response.valid;
        } catch (error) {
            return false;
        }
    }

    // UI Methods
    showLogin() {
        this.hideAllSections();
        document.getElementById('login-section').classList.remove('d-none');
    }

    showDashboard() {
        this.hideAllSections();
        document.getElementById('dashboard-section').classList.remove('d-none');
    }

    hideAllSections() {
        document.getElementById('loading-screen').classList.add('d-none');
        document.getElementById('login-section').classList.add('d-none');
        document.getElementById('dashboard-section').classList.add('d-none');
    }

    showLoadingState() {
        const content = document.getElementById('dashboard-content');
        if (content) {
            content.innerHTML = `
                <div class="text-center py-5">
                    <div class="fema-loader"></div>
                    <p class="mt-3">Loading your case information...</p>
                </div>
            `;
        }
    }

    hideLoadingState() {
        // Content will be populated by displayDashboard
    }

    showAlert(message, type, duration = 0) {
        const alertDiv = document.getElementById('login-alert');
        if (alertDiv) {
            alertDiv.textContent = message;
            alertDiv.className = `alert alert-${type} mt-3`;
            alertDiv.classList.remove('d-none');

            if (duration > 0) {
                setTimeout(() => {
                    alertDiv.classList.add('d-none');
                }, duration);
            }
        }
    }

    setLoginButtonState(loading) {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            if (loading) {
                loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Authenticating...';
                loginBtn.disabled = true;
            } else {
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Access Case';
                loginBtn.disabled = false;
            }
        }
    }

    validateLoginInput(caseNumber, lastName, password) {
        return caseNumber.length > 0 && lastName.length > 0 && password.length > 0;
    }

    logout() {
        if (this.state.token) {
            this.apiCall('/logout', 'POST').catch(() => {});
        }
        
        this.clearSession();
        this.showLogin();
        this.showAlert('You have been logged out.', 'info', 3000);
    }

    clearSession() {
        this.state.token = null;
        this.state.user = null;
        localStorage.removeItem('fema_token');
        localStorage.removeItem('fema_user');
        
        if (this.state.sessionTimer) {
            clearInterval(this.state.sessionTimer);
        }
    }
}

// Initialize the application
const femaSystem = new FEMACaseSystem();

// Make logout available globally
window.logout = () => femaSystem.logout();