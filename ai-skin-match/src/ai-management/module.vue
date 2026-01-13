<template>
    <private-view title="AI Match Management">
        <template #actions>
            <v-button @click="startRetrain" :loading="isProcessing" kind="primary">
                <v-icon name="refresh" left />
                Force Retrain AI
            </v-button>
        </template>

        <div class="ai-management-layout">
            <v-sheet v-if="selectedLogEntry" class="display-panel">
                <div class="panel-header">
                    <v-chip v-if="selectedLogEntry.is_active" color="green" x-small>ACTIVE MODEL</v-chip>
                    <v-chip v-else color="gray" x-small>ARCHIVED MODEL</v-chip>
                    <span class="trained-date">รอบการเทรนเมื่อ: {{ formatDate(selectedLogEntry.date_trained) }}</span>
                </div>

                <div class="visual-grid">
                    <div class="visual-item">
                        <div class="visual-title">Skin Type Clustering (PCA 2D)</div>
                        <div class="img-wrapper">
                            <img :key="selectedLogEntry.id + 'cluster'"
                                :src="getImageUrl(selectedLogEntry.cluster_visualization)" alt="Clustering" />
                        </div>
                    </div>
                    <div class="visual-item">
                        <div class="visual-title">Ingredient Association Rules</div>
                        <div class="img-wrapper">
                            <img :key="selectedLogEntry.id + 'assoc'"
                                :src="getImageUrl(selectedLogEntry.association_visualization)" alt="Association" />
                        </div>
                    </div>
                </div>
            </v-sheet>

            <v-sheet class="history-panel">
                <div class="section-title">Training History & Performance Metrics</div>

                <v-table :headers="tableHeaders" :items="trainingLogsList" class="log-table">
                    <template #[`item.is_active`]="{ item }">
                        <v-icon v-if="item.is_active" name="check_circle" color="green"
                            v-tooltip="'This model is currently in use'" />
                        <v-icon v-else name="history" color="gray" style="opacity: 0.5;" />
                    </template>

                    <template #[`item.date_trained`]="{ item }">
                        {{ formatDate(item.date_trained) }}
                    </template>

                    <template #[`item.accuracy`]="{ item }">
                        {{ item.accuracy != null ? (Number(item.accuracy) * 100).toFixed(2) + '%' : '0.00%' }}
                    </template>

                    <template #[`item.f1_score`]="{ item }">
                        {{ item.f1_score != null ? Number(item.f1_score).toFixed(4) : '0.0000' }}
                    </template>

                    <template #[`item.silhouette_score`]="{ item }">
                        {{ item.silhouette_score != null ? Number(item.silhouette_score).toFixed(4) : '0.0000' }}
                    </template>

                    <template #[`item.sum_of_squared_errors`]="{ item }">
                        {{ item.sum_of_squared_errors != null ? Number(item.sum_of_squared_errors).toFixed(2) : '0.00'
                        }}
                    </template>

                    <template #[`item.view_action`]="{ item }">
                        <v-button v-if="selectedLogEntry?.id !== item.id" secondary x-small class="uniform-btn"
                            @click="selectedLogEntry = item">
                            View Plots
                        </v-button>
                        <v-button v-else disabled x-small class="uniform-btn disabled-view-btn">
                            Viewing
                        </v-button>
                    </template>

                    <template #[`item.set_active_action`]="{ item }">
                        <v-button 
                            v-if="!item.is_active" 
                            kind="primary"
                            x-small 
                            color="var(--green)"
                            class="uniform-btn active-btn"
                            :loading="isProcessing && processingId === item.id"
                            @click="handleSetActive(item)"
                        >
                            Set Active
                        </v-button>
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
            { text: 'Active', value: 'is_active', width: 70, align: 'center' },
            { text: 'Trained Date', value: 'date_trained', width: 180 },
            { text: 'Accuracy', value: 'accuracy', align: 'center' },
            { text: 'F1 Score', value: 'f1_score', align: 'center' },
            { text: 'Silhouette', value: 'silhouette_score', align: 'center' },
            { text: 'SSE', value: 'sum_of_squared_errors', align: 'center' },
            { text: '', value: 'view_action', sortable: false, align: 'left', width: 110 },
            { text: '', value: 'set_active_action', sortable: false, align: 'left', width: 110 },
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
            } catch (error) {
                console.error('[AI-MGMT] Fetch Logs Error:', error);
            }
        };

        const startRetrain = async () => {
            if (!confirm('Are you sure you want to trigger AI retraining?')) return;
            isProcessing.value = true;
            try {
                await api.post('/recommend/trigger-retrain');
                await fetchTrainingLogs();
                alert('AI Retraining Triggered Successfully');
            } catch (error) {
                alert('Retraining Failed: ' + (error.response?.data?.error || error.message));
            } finally {
                isProcessing.value = false;
            }
        };

        const handleSetActive = async (item) => {
            if (!confirm(`คุณต้องการเปลี่ยนไปใช้โมเดลของวันที่ ${formatDate(item.date_trained)} เป็นหลักใช่หรือไม่?`)) return;

            isProcessing.value = true;
            processingId.value = item.id;
            try {
                await api.post('/recommend/switch-model', { id: item.id });
                await fetchTrainingLogs();
                alert('เปลี่ยนโมเดลที่เปิดใช้งานสำเร็จ!');
            } catch (error) {
                alert('Error switching model: ' + (error.response?.data?.error || error.message));
            } finally {
                isProcessing.value = false;
                processingId.value = null;
            }
        };

        const getImageUrl = (fileId) => {
            if (!fileId) return '';
            const token = api.defaults.headers.common['Authorization']?.split(' ')[1];
            return `/assets/${fileId}${token ? `?access_token=${token}` : ''}`;
        };

        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            return new Date(dateString).toLocaleString('th-TH', {
                year: '2-digit', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        };

        onMounted(fetchTrainingLogs);

        return {
            trainingLogsList,
            selectedLogEntry,
            tableHeaders,
            isProcessing,
            processingId,
            startRetrain,
            handleSetActive,
            getImageUrl,
            formatDate,
        };
    },
};
</script>

<style scoped>
.ai-management-layout {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 32px;
    min-height: 100%;
}

.display-panel {
    padding: 24px;
    border: 1px solid var(--border-normal);
    border-radius: 12px;
    background-color: var(--background-normal);
}

.panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
}

.trained-date {
    font-weight: 600;
    color: var(--foreground-subdued);
}

.visual-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
}

.visual-item {
    background: var(--background-subdued);
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
    max-height: 350px;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #ffffff;
    border-radius: 4px;
}

.img-wrapper img {
    max-width: 100%;
    max-height: 350px;
    object-fit: contain;
}

.history-panel {
    padding: 24px;
    border-radius: 12px;
    background-color: var(--background-normal);
    border: 1px solid var(--border-normal);
    margin-bottom: 50px;
}

.section-title {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 20px;
    color: var(--foreground-normal);
}

.log-table {
    width: 100%;
    min-height: 200px;
}

.uniform-btn {
    width: 100px;
    justify-content: center;
    font-weight: 600;
}

.active-btn {
    --v-button-background-color: var(--green);
    --v-button-background-color-hover: var(--green-75);
    --v-button-color: white;
}

.disabled-view-btn {
    background-color: var(--background-subdued) !important;
    border: 1px solid var(--border-subdued) !important;
    color: var(--foreground-subdued) !important;
    opacity: 0.8;
}
</style>