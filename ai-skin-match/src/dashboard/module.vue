<template>
    <private-view title="แดชบอร์ดสรุปภาพรวม">
        <!-- FILTER -->
        <v-sheet class="filter-container">
            <div class="filter-bar">
                <div class="filter-left">
                    <div class="filter-title">ช่วงวันที่ขาย</div>

                    <datepicker class="date-picker" :value="filter.dateFrom" placeholder="จากวันที่"
                        @input="filter.dateFrom = $event" />

                    <span class="separator">–</span>

                    <datepicker class="date-picker" :value="filter.dateTo" placeholder="ถึงวันที่"
                        @input="filter.dateTo = $event" />
                </div>

                <div class="filter-actions">
                    <v-button kind="primary" @click="fetchData" :loading="loading" class="dashboard-btn">
                        ค้นหา
                    </v-button>

                    <v-button secondary @click="resetDate" class="clear-btn">
                        เคลียร์
                    </v-button>
                </div>
            </div>
        </v-sheet>

        <!-- DASHBOARD -->
        <div class="dashboard-layout">
            <!-- BUSINESS -->
            <div class="stat-grid stat-grid--primary">
                <v-sheet class="stat-card stat-card--big success-border">
                    <div class="stat-label">ยอดขายรวม (ชำระเงินแล้ว)</div>
                    <div class="stat-value success-text">
                        ฿{{ formatNumber(stats.totalSales) }}
                    </div>
                </v-sheet>

                <v-sheet class="stat-card stat-card--big">
                    <div class="stat-label">จำนวนสมาชิก (Member)</div>
                    <div class="stat-value">{{ stats.memberCount }}</div>
                </v-sheet>
            </div>

            <!-- STOCK -->
            <div class="stat-grid">
                <v-sheet class="stat-card">
                    <div class="stat-label">สินค้าทั้งหมด</div>
                    <div class="stat-value">{{ stats.totalProducts }}</div>
                </v-sheet>

                <v-sheet class="stat-card">
                    <div class="stat-label">สินค้าใกล้หมด (&lt; 10)</div>
                    <div class="stat-value warning-text">{{ stats.lowStock }}</div>
                </v-sheet>

                <v-sheet class="stat-card">
                    <div class="stat-label">สินค้าหมดสต๊อก</div>
                    <div class="stat-value danger-text">{{ stats.outOfStock }}</div>
                </v-sheet>
            </div>

            <!-- EXPIRY -->
            <div class="stat-grid">
                <v-sheet class="stat-card warning-border">
                    <div class="stat-label">ใกล้หมดอายุ (&lt; 3 เดือน)</div>
                    <div class="stat-value warning-text">{{ stats.nearExpiry }}</div>
                </v-sheet>

                <v-sheet class="stat-card danger-border">
                    <div class="stat-label">หมดอายุแล้ว</div>
                    <div class="stat-value danger-text">{{ stats.expired }}</div>
                </v-sheet>
            </div>

            <!-- TOP SELLERS -->
            <v-sheet class="table-panel">
                <div class="bigger-title">10 อันดับสินค้าขายดี</div>

                <div class="rank-list">
                    <div v-for="item in topSellers" :key="item.id" class="rank-row" @click="onRowClick(item)">
                        <div class="rank-badge">{{ item.rank }}</div>

                        <div class="rank-content">
                            <div class="product-name">{{ item.name }}</div>

                            <div class="metrics">
                                <div class="qty">
                                    {{ formatNumber(item.qty_sold) }} ชิ้น
                                </div>
                                <div class="revenue">
                                    ฿{{ formatNumber(item.total_revenue) }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </v-sheet>
        </div>
    </private-view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import datepicker from './components/datepicker.vue';

const api = useApi();
const loading = ref(false);

const filter = ref({
    dateFrom: null,
    dateTo: null
});

const stats = ref({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    nearExpiry: 0,
    expired: 0,
    totalSales: 0,
    memberCount: 0
});

const topSellers = ref([]);

const fetchData = async () => {
    loading.value = true;

    try {
        /* ================= PRODUCTS ================= */
        const prodRes = await api.get('/items/product', {
            params: {
                limit: -1,
                fields: ['stock', 'expiry_date']
            }
        });

        const prods = prodRes.data.data;
        const now = new Date();
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(now.getMonth() + 3);

        stats.value.totalProducts = prods.length;

        stats.value.lowStock = prods.filter(p =>
            p.stock > 0 && p.stock < 10
        ).length;

        stats.value.outOfStock = prods.filter(p =>
            p.stock <= 0
        ).length;

        stats.value.nearExpiry = prods.filter(p => {
            if (!p.expiry_date) return false;
            const expiry = new Date(p.expiry_date);
            return expiry > now && expiry <= threeMonthsLater;
        }).length;

        stats.value.expired = prods.filter(p => {
            if (!p.expiry_date) return false;
            return new Date(p.expiry_date) < now;
        }).length;

        /* ================= SALES ================= */
        const salesFilter = { status: { _eq: 'paid' } };

        if (filter.value.dateFrom && filter.value.dateTo) {
            salesFilter.order_date = {
                _between: [filter.value.dateFrom, filter.value.dateTo]
            };
        }

        const orderRes = await api.get('/items/order', {
            params: {
                filter: salesFilter,
                fields: ['total_price'],
                limit: -1
            }
        });

        stats.value.totalSales = orderRes.data.data.reduce(
            (sum, o) => sum + Number(o.total_price || 0),
            0
        );

        /* ================= MEMBERS ================= */
        const userRes = await api.get('/users', {
            params: {
                aggregate: { count: '*' },
                filter: { role: { name: { _eq: 'Member' } } }
            }
        });

        stats.value.memberCount = userRes.data.data[0].count;

        const detailFilter = {};

        if (filter.value.dateFrom && filter.value.dateTo) {
            detailFilter.order_id = {
                order_date: {
                    _between: [filter.value.dateFrom, filter.value.dateTo]
                }
            };
        }

        const detailRes = await api.get('/items/order_detail', {
            params: {
                filter: detailFilter,
                fields: [
                    'product_id.id',
                    'product_id.name',
                    'quantity',
                    'price_at_purchase',
                    'order_id.order_date'
                ],
                limit: -1
            }
        });

        const grouped = {};

        detailRes.data.data.forEach(row => {
            const id = row.product_id?.id;
            if (!id) return;

            if (!grouped[id]) {
                grouped[id] = {
                    id,
                    name: row.product_id.name,
                    qty_sold: 0,
                    total_revenue: 0
                };
            }

            grouped[id].qty_sold += Number(row.quantity);
            grouped[id].total_revenue +=
                Number(row.quantity) * Number(row.price_at_purchase);
        });

        topSellers.value = Object.values(grouped)
            .sort((a, b) => b.qty_sold - a.qty_sold)
            .slice(0, 10)
            .map((item, index) => ({
                ...item,
                rank: index + 1
            }));

    } catch (err) {
        console.error(err);
    } finally {
        loading.value = false;
    }
};

const resetDate = () => {
    filter.value.dateFrom = null;
    filter.value.dateTo = null;
    fetchData();
};

const onRowClick = (item) => {
    window.location.href = `/admin/content/product/${item.id}`;
};

const formatNumber = (val) => new Intl.NumberFormat().format(val);

onMounted(fetchData);
</script>

<style scoped>
/* ===============================
   FILTER BAR
================================ */
.filter-container {
    padding: 24px;
    border-bottom: 1px solid var(--border-subdued);
    background: var(--background-page);
}

.filter-bar {
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
}

.filter-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.filter-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground-subdued);
    margin-right: 8px;
}

.separator {
    font-size: 14px;
    color: var(--foreground-subdued);
}

.filter-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

:deep(.date-picker) {
    width: 220px !important;
}

:deep(.date-picker .v-input) {
    width: 220px !important;
    height: 44px !important;
    display: flex;
    align-items: center;
}

.dashboard-btn {
    min-width: 110px !important;
    height: 44px !important;
    font-weight: 600 !important;
}

.clear-btn {
    height: 44px !important;
    padding: 0 16px !important;
    opacity: 0.75;
}

.clear-btn:hover {
    opacity: 1;
}

/* ===============================
   DASHBOARD LAYOUT
================================ */
.dashboard-layout {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 32px;
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 24px;
}

/* ===============================
   STAT CARDS
================================ */
.stat-card {
    min-height: 120px;
    padding: 28px 24px;
    border-radius: 14px;
    border: 1px solid var(--border-normal);
    background: var(--background-page);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    transition: all 0.2s ease;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}

.stat-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground-subdued);
    margin-bottom: 10px;
}

.stat-value {
    font-size: 32px;
    font-weight: 800;
    color: var(--foreground-normal);
    line-height: 1.2;
}

/* status colors */
.success-text {
    color: var(--green);
}

.warning-text {
    color: var(--orange);
}

.danger-text {
    color: var(--red);
}

.success-border {
    border-top: 6px solid var(--green);
}

.warning-border {
    border-top: 6px solid var(--orange);
}

.danger-border {
    border-top: 6px solid var(--red);
}

/* ===============================
   TOP SELLERS PANEL
================================ */
.table-panel {
    padding: 32px;
    border-radius: 16px;
    border: 1px solid var(--border-normal);
    background: var(--background-page);
}

.bigger-title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 24px;
    color: var(--foreground-normal);
}

/* ===============================
   RANK LIST
================================ */
.rank-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.rank-row {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-radius: 12px;
    border: 1px solid var(--border-subdued);
    background: var(--background-page);
    cursor: pointer;
    transition: all 0.2s ease;
}

.rank-row:hover {
    background: var(--background-subdued);
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}

.rank-badge {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
}

.rank-content {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.product-name {
    font-size: 16px;
    font-weight: 600;
}

.metrics {
    display: flex;
    gap: 32px;
    align-items: center;
}

.qty {
    font-size: 13px;
    color: var(--foreground-subdued);
}

.revenue {
    font-size: 17px;
    font-weight: 800;
}

/* top 3 colors */
.rank-row:nth-child(1) .rank-badge {
    background: linear-gradient(135deg, #f5c542, #f59e0b);
}

.rank-row:nth-child(2) .rank-badge {
    background: linear-gradient(135deg, #cbd5e1, #94a3b8);
}

.rank-row:nth-child(3) .rank-badge {
    background: linear-gradient(135deg, #d97706, #92400e);
}

.stat-grid--primary {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.stat-card--big {
    min-height: 150px;
}

.stat-card--big .stat-value {
    font-size: 40px;
}

</style>
