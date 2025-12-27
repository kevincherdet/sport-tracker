// Sport Tracker App
const App = {
    currentDate: new Date(),
    selectedGainageType: 'normal',
    currentPeriod: 'week',
    data: {},

    init() {
        this.loadData();
        this.bindEvents();
        this.updateDateDisplay();
        this.renderDay();
        this.registerServiceWorker();
    },

    // Data Management
    loadData() {
        const saved = localStorage.getItem('sportTracker');
        this.data = saved ? JSON.parse(saved) : {};
    },

    saveData() {
        localStorage.setItem('sportTracker', JSON.stringify(this.data));
    },

    getDateKey(date = this.currentDate) {
        return date.toISOString().split('T')[0];
    },

    getDayData(dateKey = this.getDateKey()) {
        if (!this.data[dateKey]) {
            this.data[dateKey] = {
                pompes: [],
                alteres: [],
                gainage: []
            };
        }
        return this.data[dateKey];
    },

    // Event Bindings
    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        // Date navigation
        document.getElementById('prev-day').addEventListener('click', () => this.changeDate(-1));
        document.getElementById('next-day').addEventListener('click', () => this.changeDate(1));

        // Add buttons
        document.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const exercise = e.target.dataset.exercise;
                const value = parseInt(e.target.dataset.value);
                this.addSeries(exercise, value);
            });
        });

        // Gainage type
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedGainageType = e.target.dataset.type;
            });
        });

        // Period buttons
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.renderDashboard();
            });
        });
    },

    // View Management
    switchView(view) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-view="${view}"]`).classList.add('active');

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(view).classList.add('active');

        if (view === 'dashboard') {
            this.renderDashboard();
        }
    },

    // Date Management
    changeDate(delta) {
        this.currentDate.setDate(this.currentDate.getDate() + delta);
        this.updateDateDisplay();
        this.renderDay();
    },

    updateDateDisplay() {
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        const dateStr = this.currentDate.toLocaleDateString('fr-FR', options);
        document.getElementById('current-date').textContent = dateStr;
    },

    // Series Management
    addSeries(exercise, value) {
        const dayData = this.getDayData();
        const series = {
            value,
            time: new Date().toISOString()
        };

        if (exercise === 'gainage') {
            series.type = this.selectedGainageType;
        }

        dayData[exercise].push(series);
        this.saveData();
        this.renderDay();

        // Animate total
        const totalEl = document.getElementById(`${exercise}-total`);
        totalEl.classList.add('pop');
        setTimeout(() => totalEl.classList.remove('pop'), 200);
    },

    deleteSeries(exercise, index) {
        const dayData = this.getDayData();
        dayData[exercise].splice(index, 1);
        this.saveData();
        this.renderDay();
    },

    // Rendering
    renderDay() {
        const dayData = this.getDayData();

        // Pompes
        this.renderSeriesList('pompes', dayData.pompes);
        document.getElementById('pompes-total').textContent =
            dayData.pompes.reduce((sum, s) => sum + s.value, 0);

        // Altères
        this.renderSeriesList('alteres', dayData.alteres);
        document.getElementById('alteres-total').textContent =
            dayData.alteres.reduce((sum, s) => sum + s.value, 0);

        // Gainage
        this.renderSeriesList('gainage', dayData.gainage, true);
        const totalSeconds = dayData.gainage.reduce((sum, s) => sum + s.value, 0);
        document.getElementById('gainage-total').textContent = this.formatTime(totalSeconds);
    },

    renderSeriesList(exercise, series, isGainage = false) {
        const container = document.getElementById(`${exercise}-series`);

        if (series.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = series.map((s, i) => {
            let display = isGainage ? this.formatTime(s.value) : s.value;
            let typeLabel = isGainage && s.type !== 'normal'
                ? `<span class="type-label">${s.type[0].toUpperCase()}</span>`
                : '';

            return `
                <div class="series-item">
                    ${typeLabel}
                    ${display}
                    <button class="delete-btn" onclick="App.deleteSeries('${exercise}', ${i})">&times;</button>
                </div>
            `;
        }).join('');
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // Dashboard
    renderDashboard() {
        const days = this.currentPeriod === 'week' ? 7 : 30;
        const stats = this.getStats(days);

        document.getElementById('stats-pompes').textContent = stats.totals.pompes;
        document.getElementById('stats-alteres').textContent = stats.totals.alteres;
        document.getElementById('stats-gainage').textContent = this.formatTime(stats.totals.gainage);

        this.renderChart('chart-pompes', stats.daily, 'pompes');
        this.renderChart('chart-alteres', stats.daily, 'alteres');
        this.renderChart('chart-gainage', stats.daily, 'gainage', true);
        this.renderHistory(stats.daily);
    },

    getStats(days) {
        const stats = {
            totals: { pompes: 0, alteres: 0, gainage: 0 },
            daily: []
        };

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = this.getDateKey(date);
            const dayData = this.data[dateKey] || { pompes: [], alteres: [], gainage: [] };

            const pompes = dayData.pompes.reduce((sum, s) => sum + s.value, 0);
            const alteres = dayData.alteres.reduce((sum, s) => sum + s.value, 0);
            const gainage = dayData.gainage.reduce((sum, s) => sum + s.value, 0);

            stats.totals.pompes += pompes;
            stats.totals.alteres += alteres;
            stats.totals.gainage += gainage;

            stats.daily.push({
                date,
                dateKey,
                pompes,
                alteres,
                gainage
            });
        }

        return stats;
    },

    renderChart(canvasId, data, exercise, isTime = false) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');

        // Set canvas size for retina
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = 150 * dpr;
        ctx.scale(dpr, dpr);

        const width = canvas.offsetWidth;
        const height = 150;
        const padding = { top: 20, right: 15, bottom: 25, left: 15 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Get values
        const values = data.map(d => d[exercise]);
        const maxValue = Math.max(...values, 1);

        // Draw subtle grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
            const y = padding.top + (chartHeight / 3) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }

        // Draw bars
        const barWidth = Math.min((chartWidth / data.length) * 0.6, 20);
        const totalBarSpace = chartWidth / data.length;

        values.forEach((value, i) => {
            const x = padding.left + totalBarSpace * i + (totalBarSpace - barWidth) / 2;
            const barHeight = Math.max((value / maxValue) * chartHeight, value > 0 ? 4 : 0);
            const y = height - padding.bottom - barHeight;

            if (value > 0) {
                // Glow effect
                ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
                ctx.shadowBlur = 10;

                // Bar gradient
                const gradient = ctx.createLinearGradient(x, y, x, height - padding.bottom);
                gradient.addColorStop(0, '#818cf8');
                gradient.addColorStop(0.5, '#6366f1');
                gradient.addColorStop(1, '#4f46e5');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, barHeight, 4);
                ctx.fill();

                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;

                // Top highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, 2, 4);
                ctx.fill();
            } else {
                // Empty bar placeholder
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.beginPath();
                ctx.roundRect(x, height - padding.bottom - 4, barWidth, 4, 2);
                ctx.fill();
            }
        });

        // Draw labels
        ctx.fillStyle = '#64748b';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';

        const labelInterval = data.length > 14 ? 7 : data.length > 7 ? 2 : 1;
        data.forEach((d, i) => {
            if (i % labelInterval === 0 || i === data.length - 1) {
                const x = padding.left + totalBarSpace * i + totalBarSpace / 2;
                const label = d.date.toLocaleDateString('fr-FR', { day: 'numeric' });
                ctx.fillText(label, x, height - 5);
            }
        });
    },

    renderHistory(daily) {
        const container = document.getElementById('history-list');

        // Show only days with activity, most recent first
        const activeDays = daily.filter(d => d.pompes > 0 || d.alteres > 0 || d.gainage > 0).reverse();

        if (activeDays.length === 0) {
            container.innerHTML = '<div class="empty-state">Aucune activité sur cette période</div>';
            return;
        }

        container.innerHTML = activeDays.slice(0, 10).map(d => `
            <div class="history-day">
                <div class="history-date">
                    ${d.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div class="history-stats">
                    ${d.pompes > 0 ? `<span>Pompes: ${d.pompes}</span>` : ''}
                    ${d.alteres > 0 ? `<span>Altères: ${d.alteres}</span>` : ''}
                    ${d.gainage > 0 ? `<span>Gainage: ${this.formatTime(d.gainage)}</span>` : ''}
                </div>
            </div>
        `).join('');
    },

    // PWA
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.log('SW registration failed:', err));
        }
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => App.init());
