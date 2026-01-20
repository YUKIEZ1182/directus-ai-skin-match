<template>
    <private-view title="ระบบจัดการ AI Skin Match">
        <template #actions>
            <v-button @click="startRetrain" :loading="isProcessing" kind="primary">
                <v-icon name="refresh" left />
                เริ่มการฝึกฝนใหม่ (Force Retrain)
            </v-button>
        </template>

        <div class="ai-management-layout">
            <v-sheet v-if="selectedLogEntry" class="display-panel">
                <div class="panel-header">
                    <v-chip v-if="selectedLogEntry.is_active" color="green" x-small>โมเดลที่ใช้งานอยู่</v-chip>
                    <v-chip v-else color="gray" x-small>ประวัติโมเดล</v-chip>
                    <span class="trained-date">รอบการฝึกฝนเมื่อ: {{ formatDate(selectedLogEntry.date_trained) }}</span>
                </div>

                <div class="visual-grid">
                    <div class="visual-item">
                        <div class="visual-title">Skin Type Clustering (การจัดกลุ่มผิว)</div>
                        <div class="img-wrapper">
                            <img :key="selectedLogEntry.id + 'cluster'"
                                :src="getImageUrl(selectedLogEntry.cluster_visualization)" alt="Clustering Plot" />
                        </div>
                    </div>
                    <div class="visual-item">
                        <div class="visual-title">Ingredient Association (คู่ส่วนผสมแนะนำ)</div>
                        <div class="img-wrapper">
                            <img :key="selectedLogEntry.id + 'assoc'"
                                :src="getImageUrl(selectedLogEntry.association_visualization)" alt="Association Plot" />
                        </div>
                    </div>
                </div>
            </v-sheet>

            <v-sheet class="history-panel">
                <div class="section-title">ประวัติการฝึกฝนและตัวชี้วัดประสิทธิภาพ (Metrics)</div>

                <v-table :headers="tableHeaders" :items="trainingLogsList" class="log-table clickable-rows"
                    @click:row="onRowClick">
                    <template #[`item.is_active`]="{ item }">
                        <v-icon v-if="item.is_active" name="check_circle" color="green" />
                        <v-icon v-else name="history" color="gray" style="opacity: 0.5;" />
                    </template>

                    <template #[`item.date_trained`]="{ item }">
                        {{ formatDate(item.date_trained) }}
                    </template>

                    <template #[`item.silhouette_score`]="{ item }">
                        <span>{{ item.silhouette_score != null ? Number(item.silhouette_score).toFixed(4) : '0.0000'
                            }}</span>
                    </template>

                    <template #[`item.sum_of_squared_errors`]="{ item }">
                        <span>{{ item.sum_of_squared_errors != null ? Number(item.sum_of_squared_errors).toFixed(2) :
                            '0.00' }}</span>
                    </template>

                    <template #[`item.avg_lift`]="{ item }">
                        <span>{{ item.avg_lift != null ? Number(item.avg_lift).toFixed(4) : '0.0000' }}</span>
                    </template>

                    <template #[`item.total_rules`]="{ item }">
                        <span>{{ item.total_rules || 0 }} กฎ</span>
                    </template>

                    <template #[`item.actions`]="{ item }">
                        <div class="action-buttons">
                            <v-button v-if="selectedLogEntry?.id !== item.id" secondary x-small
                                class="uniform-btn clickable-btn" @click.stop="selectedLogEntry = item">
                                ดูรูปกราฟ
                            </v-button>

                            <div v-else class="uniform-btn status-disabled">
                                กำลังดู
                            </div>

                            <v-button v-if="!item.is_active" kind="primary" x-small color="var(--green)"
                                class="uniform-btn active-btn" :loading="isProcessing && processingId === item.id"
                                @click.stop="handleSetActive(item)">
                                เปิดใช้งาน
                            </v-button>
                        </div>
                    </template>
                </v-table>
            </v-sheet>
        </div>
    </private-view>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';

export default {
    setup() {
        const api = useApi();
        const trainingLogsList = ref([]);
        const selectedLogEntry = ref(null);
        const isProcessing = ref(false);
        const processingId = ref(null);

        const tableHeaders = [
            { text: 'สถานะ', value: 'is_active', width: 80, align: 'center' },
            { text: 'วันที่ฝึกฝน', value: 'date_trained', width: 160 },
            { text: 'Silhouette (Clustering)', value: 'silhouette_score', align: 'center', width: 220 },
            { text: 'SSE (Clustering)', value: 'sum_of_squared_errors', align: 'center', width: 160 },
            { text: 'Avg Lift (Assoc)', value: 'avg_lift', align: 'center', width: 160 },
            { text: 'Rules (Assoc)', value: 'total_rules', align: 'center', width: 160 },
            { text: '', value: 'actions', sortable: false, align: 'left', width: 280 },
        ];

        const fetchTrainingLogs = async () => {
            try {
                const response = await api.get('/items/model_training_log', {
                    params: { sort: '-date_trained', limit: 50 }
                });
                trainingLogsList.value = response.data.data || [];
                if (!selectedLogEntry.value && trainingLogsList.value.length > 0) {
                    const activeModel = trainingLogsList.value.find((log) => log.is_active);
                    selectedLogEntry.value = activeModel || trainingLogsList.value[0];
                }
            } catch (error) { console.error(error); }
        };

        const startRetrain = async () => {
            if (!confirm('ยืนยันเริ่มการฝึกฝน AI ใหม่?')) return;
            isProcessing.value = true;
            try {
                await api.post('/recommend/trigger-retrain');
                await fetchTrainingLogs();
            } catch (e) { alert(e.message); }
            finally { isProcessing.value = false; }
        };

        const handleSetActive = async (item) => {
            if (!confirm('สลับไปใช้โมเดลนี้เป็นหลัก?')) return;
            isProcessing.value = true;
            processingId.value = item.id;
            try {
                await api.post('/recommend/switch-model', { id: item.id });
                await fetchTrainingLogs();
            } catch (e) { alert(e.message); }
            finally {
                isProcessing.value = false;
                processingId.value = null;
            }
        };

        const onRowClick = ({ item }) => {
            window.location.href = `/admin/content/model_training_log/${item.id}`;
        };

        const getImageUrl = (id) => {
            if (!id) return '';
            const token = api.defaults.headers.common['Authorization']?.split(' ')[1];
            return `/assets/${id}${token ? `?access_token=${token}` : ''}`;
        };

        const formatDate = (d) => d ? new Date(d).toLocaleString('th-TH', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

        onMounted(fetchTrainingLogs);

        return { trainingLogsList, selectedLogEntry, tableHeaders, isProcessing, processingId, startRetrain, handleSetActive, onRowClick, getImageUrl, formatDate };
    },
};
</script>

<style scoped>
.action-buttons {
    display: flex;
    gap: 12px;
    justify-content: flex-start;
    align-items: center;
}

.uniform-btn {
    width: 110px !important;
    height: 32px !important;
    display: inline-flex !important;
    justify-content: center !important;
    align-items: center !important;
    font-weight: 600 !important;
    border-radius: 4px !important;
    font-size: 13px !important;
    border: none !important;
    box-shadow: none !important;
}

.clickable-btn {
    color: var(--primary) !important;
    cursor: pointer;
}

.status-disabled {
    background: transparent !important;
    color: var(--foreground-subdued) !important;
    opacity: 0.5;
    cursor: default;
}

.active-btn {
    --v-button-background-color: var(--green);
    --v-button-color: white;
}

.clickable-rows :deep(tbody tr) {
    cursor: pointer;
}

.ai-management-layout {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 32px;
}

.display-panel {
    padding: 24px;
    border: 1px solid var(--border-normal);
    border-radius: 12px;
}

.panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
}

.visual-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
}

.visual-item {
    padding: 16px;
    border-radius: 8px;
    text-align: center;
    border: 1px solid var(--border-subdued);
}

.visual-title {
    font-weight: bold;
    margin-bottom: 12px;
    font-size: 13px;
    text-transform: uppercase;
    color: var(--foreground-subdued);
}

.img-wrapper {
    width: 100%;
    max-height: 380px;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #ffffff;
    border-radius: 4px;
    border: 1px solid var(--border-subdued);
}

.img-wrapper img {
    max-width: 100%;
    max-height: 380px;
    object-fit: contain;
}

.history-panel {
    padding: 24px;
    border-radius: 12px;
    border: 1px solid var(--border-normal);
    margin-bottom: 50px;
}

.section-title {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 20px;
}
</style>