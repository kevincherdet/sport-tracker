// Supabase config
const SUPABASE_URL = 'https://rggziitehltqtdmkgctb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZ3ppaXRlaGx0cXRkbWtnY3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NjEyMTYsImV4cCI6MjA4MjQzNzIxNn0.up6vqFQswoLAVpyjWU_PHTuvepOzcv4L9Efg4TCYgwI';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sport Tracker App
const App = {
    currentDate: new Date(),
    selectedGainageType: 'normal',
    currentPeriod: 'week',
    dayData: { pompes: [], alteres: [], gainage: [] },

    async init() {
        this.bindEvents();
        this.updateDateDisplay();
        await this.loadDay();
        this.registerServiceWorker();
    },

    // Date helpers
    getDateKey(date = this.currentDate) {
        return date.toISOString().split('T')[0];
    },

    // Load data from Supabase
    async loadDay() {
        const dateKey = this.getDateKey();

        const { data, error } = await db
            .from('exercises')
            .select('*')
            .eq('date', dateKey)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error loading data:', error);
            return;
        }

        // Transform data
        this.dayData = { pompes: [], alteres: [], gainage: [] };

        data.forEach(row => {
            const item = {
                id: row.id,
                value: row.value
            };
            if (row.exercise_type === 'gainage') {
                item.type = row.gainage_type || 'normal';
            }
            this.dayData[row.exercise_type].push(item);
        });

        this.renderDay();
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

        // Free input for pompes
        document.getElementById('pompes-free-btn').addEventListener('click', () => {
            const input = document.getElementById('pompes-free-input');
            const value = parseInt(input.value);
            if (value && value > 0) {
                this.addSeries('pompes', value);
                input.value = '';
            }
        });

        // Allow Enter key to add pompes
        document.getElementById('pompes-free-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('pompes-free-btn').click();
            }
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
    async changeDate(delta) {
        this.currentDate.setDate(this.currentDate.getDate() + delta);
        this.updateDateDisplay();
        await this.loadDay();
    },

    updateDateDisplay() {
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        const dateStr = this.currentDate.toLocaleDateString('fr-FR', options);
        document.getElementById('current-date').textContent = dateStr;
    },

    // Series Management
    async addSeries(exercise, value) {
        const dateKey = this.getDateKey();

        const insertData = {
            date: dateKey,
            exercise_type: exercise,
            value: value
        };

        if (exercise === 'gainage') {
            insertData.gainage_type = this.selectedGainageType;
        }

        const { data, error } = await db
            .from('exercises')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Error adding series:', error);
            return;
        }

        // Add to local data
        const item = { id: data.id, value: data.value };
        if (exercise === 'gainage') {
            item.type = data.gainage_type;
        }
        this.dayData[exercise].push(item);

        this.renderDay();

        // Animate total
        const totalEl = document.getElementById(`${exercise}-total`);
        totalEl.classList.add('pop');
        setTimeout(() => totalEl.classList.remove('pop'), 200);
    },

    async deleteSeries(exercise, index) {
        const item = this.dayData[exercise][index];

        const { error } = await db
            .from('exercises')
            .delete()
            .eq('id', item.id);

        if (error) {
            console.error('Error deleting series:', error);
            return;
        }

        this.dayData[exercise].splice(index, 1);
        this.renderDay();
    },

    // Rendering
    renderDay() {
        // Pompes
        this.renderSeriesList('pompes', this.dayData.pompes);
        document.getElementById('pompes-total').textContent =
            this.dayData.pompes.reduce((sum, s) => sum + s.value, 0);

        // Altères
        this.renderSeriesList('alteres', this.dayData.alteres);
        document.getElementById('alteres-total').textContent =
            this.dayData.alteres.reduce((sum, s) => sum + s.value, 0);

        // Gainage
        this.renderSeriesList('gainage', this.dayData.gainage, true);
        const totalSeconds = this.dayData.gainage.reduce((sum, s) => sum + s.value, 0);
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
    async renderDashboard() {
        const days = this.currentPeriod === 'week' ? 7 : 30;
        const stats = await this.getStats(days);

        document.getElementById('stats-pompes').textContent = stats.totals.pompes;
        document.getElementById('stats-alteres').textContent = stats.totals.alteres;
        document.getElementById('stats-gainage').textContent = this.formatTime(stats.totals.gainage);

        this.renderChart('chart-pompes', stats.daily, 'pompes');
        this.renderChart('chart-alteres', stats.daily, 'alteres');
        this.renderChart('chart-gainage', stats.daily, 'gainage', true);
        this.renderHistory(stats.daily);
    },

    async getStats(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);

        const { data, error } = await db
            .from('exercises')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0])
            .lte('date', endDate.toISOString().split('T')[0]);

        if (error) {
            console.error('Error fetching stats:', error);
            return { totals: { pompes: 0, alteres: 0, gainage: 0 }, daily: [] };
        }

        // Build daily stats
        const dailyMap = {};
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            dailyMap[dateKey] = { date, dateKey, pompes: 0, alteres: 0, gainage: 0 };
        }

        // Aggregate data
        data.forEach(row => {
            if (dailyMap[row.date]) {
                dailyMap[row.date][row.exercise_type] += row.value;
            }
        });

        const daily = Object.values(dailyMap);
        const totals = {
            pompes: daily.reduce((sum, d) => sum + d.pompes, 0),
            alteres: daily.reduce((sum, d) => sum + d.alteres, 0),
            gainage: daily.reduce((sum, d) => sum + d.gainage, 0)
        };

        return { totals, daily };
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
