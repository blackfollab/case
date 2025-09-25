class FEMACaseSystem {
    constructor() {
        this.API_BASE = 'https://case-1w9w.onrender.com/api';
        this.state = { 
            token: null, 
            user: null 
        };
        this.init();
    }

    async init() {
        console.log('🚀 FEMA System Initializing...');
        await this.checkExistingSession();
        this.setupEventListeners();
    }

    async checkExistingSession() {
        const savedSession = localStorage.getItem('fema_session');
        
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                if (session.token && session.user) {
                    this.state.token = session.token;
                    this.state.user = session.user;
                    
                    // Verify token is still valid
                    const isValid = await this.verifyToken();
                    if (isValid) {
                        await this.loadDashboard();
                        this.showDashboard();
                        return;
                    }
                }
            } catch (error) {
                console.error('Session load error:', error);
            }
        }
        
        this.clearSession();
        this.showLogin();
    }

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const caseNumber = document.getElementById('case-number').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('login-btn');

        if (!caseNumber || !lastName || !password) {
            this.showAlert('Please fill in all fields', 'danger');
            return;
        }

        this.setLoginButtonState(true, 'Signing In...');

        try {
            const response = await this.apiCall('/login', 'POST', {
                case_number: caseNumber,
                last_name: lastName,
                password: password
            });

            if (response.success) {
                this.state.token = response.token;
                this.state.user = response.user;
                
                localStorage.setItem('fema_session', JSON.stringify({
                    token: response.token,
                    user: response.user
                }));

                await this.loadDashboard();
                this.showDashboard();
                this.showAlert('Login successful!', 'success', 3000);
            } else {
                this.showAlert(response.error || 'Login failed', 'danger');
            }
        } catch (error) {
            this.showAlert('Network error: ' + error.message, 'danger');
        } finally {
            this.setLoginButtonState(false, 'Access Case');
        }
    }

    async loadDashboard() {
        this.showLoadingState();
        
        try {
            const response = await this.apiCall('/dashboard', 'GET');
            
            if (response.success) {
                this.displayDashboardData(response.data);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showAlert('Failed to load dashboard: ' + error.message, 'danger');
        } finally {
            this.hideLoadingState();
        }
    }

    displayDashboardData(data) {
        const contentElement = document.getElementById('dashboard-content');
        if (contentElement) {
            contentElement.innerHTML = this.generateDashboardHTML(data);
        }
    }

    generateDashboardHTML(data) {
        const user = data.user || {};
        const lawyer = data.lawyer || {};
        const courtVisits = data.court_visits || [];
        
        return `
            <!-- User Profile Section -->
            <div class="row mb-4">
                <div class="col-md-4 mb-3">
                    <div class="dashboard-card p-4 text-center">
                        <div class="user-photo-container mb-3">
                            <img src="${user.photo_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'}" 
                                 alt="${user.first_name} ${user.last_name}" 
                                 class="user-photo-img">
                        </div>
                        <h4>${user.first_name} ${user.last_name}</h4>
                        <p class="text-muted mb-2">${user.case_number}</p>
                        <span class="badge bg-success">${user.status || 'active'}</span>
                    </div>
                </div>
                
                <div class="col-md-8">
                    <div class="row h-100">
                        <div class="col-6 mb-3">
                            <div class="stat-card p-3 h-100">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-muted mb-1">Total Amount</h6>
                                        <h4 class="mb-0">$${(user.total_amount || 0).toLocaleString()}</h4>
                                    </div>
                                    <i class="fas fa-dollar-sign fa-2x text-muted"></i>
                                </div>
                            </div>
                        </div>
                        <div class="col-6 mb-3">
                            <div class="stat-card p-3 h-100">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-muted mb-1">Amount Paid</h6>
                                        <h4 class="mb-0 text-success">$${(data.amount_paid || 0).toLocaleString()}</h4>
                                    </div>
                                    <i class="fas fa-check-circle fa-2x text-success"></i>
                                </div>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="stat-card p-3 h-100">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-muted mb-1">Amount Remaining</h6>
                                        <h4 class="mb-0 text-warning">$${(data.amount_remaining || 0).toLocaleString()}</h4>
                                    </div>
                                    <i class="fas fa-clock fa-2x text-warning"></i>
                                </div>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="stat-card p-3 h-100">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="text-muted mb-1">Completion</h6>
                                        <h4 class="mb-0">${data.progress || 0}%</h4>
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
                    <span class="badge bg-primary">${data.progress || 0}%</span>
                </div>
                <div class="progress mb-2" style="height: 25px;">
                    <div class="progress-bar" style="width: ${data.progress || 0}%">
                        ${data.progress || 0}%
                    </div>
                </div>
                <small class="text-muted">Based on total settlement amount and verified payments</small>
            </div>

            <!-- Court Timeline -->
            <div class="dashboard-card p-4 mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0"><i class="fas fa-gavel me-2"></i>Court Timeline</h5>
                    <small class="text-muted">Recent activity</small>
                </div>
                ${this.generateCourtTimeline(courtVisits)}
            </div>

            <!-- Payment History -->
            <div class="dashboard-card p-4 mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0">Payment History</h5>
                    <small class="text-muted">Last 6 months</small>
                </div>
                ${this.generatePaymentsHTML(data.payments || [])}
            </div>

            <!-- Legal Representative -->
            <div class="dashboard-card p-4">
                <h5 class="mb-3"><i class="fas fa-user-tie me-2"></i>Assigned Legal Representative</h5>
                ${this.generateLawyerHTML(lawyer)}
            </div>
        `;
    }

    generateCourtTimeline(visits) {
        if (!visits.length) {
            return '<p class="text-muted text-center py-3">No court visits recorded</p>';
        }

        return `
            <div class="court-timeline">
                ${visits.map((visit, index) => `
                    <div class="court-event ${index === 0 ? 'next-court-date' : ''}">
                        <div class="court-event-date">
                            <i class="fas fa-calendar-day me-2"></i>
                            ${new Date(visit.date).toLocaleDateString()}
                        </div>
                        <div class="court-event-type">
                            <strong>${visit.type || 'Hearing'}</strong> - ${visit.purpose || 'Case Review'}
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="small text-muted">${visit.location || 'Federal Courthouse'}</span>
                            <span class="court-event-outcome ${visit.outcome === 'APPROVED' ? 'outcome-positive' : 'outcome-pending'}">
                                ${visit.outcome || 'PENDING'}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    generatePaymentsHTML(payments) {
        if (!payments.length) {
            return '<p class="text-muted text-center py-3">No payment history available</p>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(payment => `
                            <tr>
                                <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                                <td>$${payment.amount.toLocaleString()}</td>
                                <td><span class="badge bg-success">${payment.status}</span></td>
                                <td>${payment.reference_id}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    generateLawyerHTML(lawyer) {
        if (!lawyer.name) {
            return `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    No legal representative has been assigned to your case yet.
                </div>
            `;
        }

        return `
            <div class="row align-items-center">
                <div class="col-md-8">
                    <div class="d-flex align-items-center mb-3">
                        <img src="${lawyer.photo_url || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face'}" 
                             alt="${lawyer.name}" 
                             class="lawyer-photo-img me-3">
                        <div>
                            <h6 class="mb-1">${lawyer.name}</h6>
                            <p class="text-muted mb-0">FEMA Case Attorney</p>
                        </div>
                    </div>
                    
                    ${lawyer.email ? `<p class="mb-1"><i class="fas fa-envelope me-2 text-muted"></i>${lawyer.email}</p>` : ''}
                    ${lawyer.phone ? `<p class="mb-0"><i class="fas fa-phone me-2 text-muted"></i>${lawyer.phone}</p>` : ''}
                    ${lawyer.bar_number ? `<p class="mb-0"><i class="fas fa-id-card me-2 text-muted"></i>Bar: ${lawyer.bar_number}</p>` : ''}
                </div>
                <div class="col-md-4 text-center">
                    <div class="security-status">
                        <i class="fas fa-link text-success me-1"></i>
                        <a href="https://www.fema.gov"><span class="text-success">Official Website</span></a>
                    </div>
                </div>
            </div>
        `;
    }

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
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }

    async verifyToken() {
        if (!this.state.token) return false;
        
        try {
            const response = await fetch(this.API_BASE + '/health');
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    showLoadingState() {
        const loading = document.getElementById('dashboard-loading');
        const content = document.getElementById('dashboard-content');
        if (loading) loading.classList.remove('d-none');
        if (content) content.classList.add('d-none');
    }

    hideLoadingState() {
        const loading = document.getElementById('dashboard-loading');
        const content = document.getElementById('dashboard-content');
        if (loading) loading.classList.add('d-none');
        if (content) content.classList.remove('d-none');
    }

    showLogin() {
        this.hideElement('loading-screen');
        this.showElement('login-section');
        this.hideElement('dashboard-section');
    }

    showDashboard() {
        this.hideElement('loading-screen');
        this.hideElement('login-section');
        this.showElement('dashboard-section');
    }

    showElement(id) {
        const element = document.getElementById(id);
        if (element) element.classList.remove('d-none');
    }

    hideElement(id) {
        const element = document.getElementById(id);
        if (element) element.classList.add('d-none');
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

    setLoginButtonState(loading, text) {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.disabled = loading;
            loginBtn.innerHTML = loading 
                ? '<i class="fas fa-spinner fa-spin me-2"></i>' + text
                : '<i class="fas fa-sign-in-alt me-2"></i>' + text;
        }
    }

    clearSession() {
        this.state.token = null;
        this.state.user = null;
        localStorage.removeItem('fema_session');
    }
}

// Initialize the application
const femaSystem = new FEMACaseSystem();

// Global logout function
window.logout = function() {
    localStorage.removeItem('fema_session');
    location.reload();
};
