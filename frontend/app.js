class FEMACaseSystem {
    constructor() {
        this.API_BASE = 'https://case-1w9w.onrender.com/api';
        this.state = { token: null, user: null };
        this.init();
    }

    async init() {
        await this.checkExistingSession();
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
    }

    async handleLogin(event) {
        event.preventDefault();
        const loginBtn = document.getElementById('login-btn');
        
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';

        try {
            const formData = {
                case_number: document.getElementById('case-number').value,
                last_name: document.getElementById('last-name').value,
                password: document.getElementById('password').value
            };

            const response = await this.apiCall('/login', 'POST', formData);
            
            if (response.success) {
                this.state.token = response.token;
                this.state.user = response.user;
                localStorage.setItem('fema_session', JSON.stringify({ token: response.token, user: response.user }));
                await this.loadDashboard();
                this.showDashboard();
            } else {
                this.showAlert(response.error, 'danger');
            }
        } catch (error) {
            this.showAlert('Login failed: ' + error.message, 'danger');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Access Case';
        }
    }

    async loadDashboard() {
        this.showLoadingState();
        try {
            const response = await this.apiCall('/dashboard', 'GET');
            this.displayDashboardData(response.data);
        } catch (error) {
            this.showAlert('Failed to load dashboard', 'danger');
        } finally {
            this.hideLoadingState();
        }
    }

    displayDashboardData(data) {
        document.getElementById('dashboard-content').innerHTML = this.generateDashboardHTML(data);
    }

    generateDashboardHTML(data) {
        return `
            <div class="row">
                <div class="col-md-4">
                    <div class="dashboard-card">
                        <div class="text-center">
                            <img src="${data.user.photo_url || 'https://via.placeholder.com/150'}" 
                                 class="user-photo" alt="User Photo">
                            <h4>${data.user.first_name} ${data.user.last_name}</h4>
                            <p class="text-muted">${data.user.case_number}</p>
                            <span class="badge bg-success">${data.user.status}</span>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-8">
                    <div class="dashboard-card">
                        <h5><i class="fas fa-lock text-success"></i> Security Status: <span class="text-success">Secure</span></h5>
                        <div class="progress mb-3">
                            <div class="progress-bar" style="width: ${data.progress}%">${data.progress}% Complete</div>
                        </div>
                    </div>

                    <!-- Court Timeline -->
                    <div class="dashboard-card">
                        <h5><i class="fas fa-gavel"></i> Court Timeline</h5>
                        ${this.generateCourtTimeline(data.court_visits)}
                    </div>
                </div>
            </div>

            <!-- Payments Section -->
            <div class="dashboard-card">
                <h5>Payment History</h5>
                ${this.generatePaymentsTable(data.payments)}
            </div>

            <!-- Lawyer Section -->
            <div class="dashboard-card">
                <div class="row">
                    <div class="col-md-8">
                        <h5>Assigned Legal Representative</h5>
                        <div class="d-flex align-items-center">
                            <img src="${data.lawyer.photo_url || 'https://via.placeholder.com/100'}" 
                                 class="lawyer-photo me-3" alt="Lawyer Photo">
                            <div>
                                <h6>${data.lawyer.name || 'Not Assigned'}</h6>
                                <p class="mb-1">${data.lawyer.email || ''}</p>
                                <p class="mb-0">${data.lawyer.phone || ''}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateCourtTimeline(visits) {
        if (!visits.length) return '<p class="text-muted">No court visits recorded</p>';
        
        return visits.map(visit => `
            <div class="court-event">
                <div class="court-date">${new Date(visit.date).toLocaleDateString()}</div>
                <div class="court-type">${visit.type} - ${visit.purpose}</div>
                <div class="court-outcome badge bg-${visit.outcome === 'APPROVED' ? 'success' : 'warning'}">${visit.outcome}</div>
            </div>
        `).join('');
    }

    generatePaymentsTable(payments) {
        if (!payments.length) return '<p class="text-muted">No payments available</p>';
        
        return `
            <table class="table table-striped">
                <thead>
                    <tr><th>Date</th><th>Amount</th><th>Status</th><th>Reference</th></tr>
                </thead>
                <tbody>
                    ${payments.map(p => `
                        <tr>
                            <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                            <td>$${p.amount.toLocaleString()}</td>
                            <td><span class="badge bg-success">${p.status}</span></td>
                            <td>${p.reference_id}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async apiCall(endpoint, method, data) {
        const response = await fetch(this.API_BASE + endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.state.token ? `Bearer ${this.state.token}` : ''
            },
            body: data ? JSON.stringify(data) : undefined
        });
        return await response.json();
    }

    showLoadingState() {
        document.getElementById('dashboard-loading').classList.remove('d-none');
        document.getElementById('dashboard-content').classList.add('d-none');
    }

    hideLoadingState() {
        document.getElementById('dashboard-loading').classList.add('d-none');
        document.getElementById('dashboard-content').classList.remove('d-none');
    }

    showDashboard() {
        document.getElementById('login-section').classList.add('d-none');
        document.getElementById('dashboard-section').classList.remove('d-none');
    }

    showAlert(message, type) {
        const alertDiv = document.getElementById('login-alert');
        alertDiv.innerHTML = message;
        alertDiv.className = `alert alert-${type} mt-3`;
        alertDiv.classList.remove('d-none');
    }
}

// Initialize app
const femaSystem = new FEMACaseSystem();
window.logout = () => {
    localStorage.removeItem('fema_session');
    location.reload();
};
