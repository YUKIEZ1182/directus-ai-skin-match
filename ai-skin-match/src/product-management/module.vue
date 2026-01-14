<template>
    <private-view title="Product Import">
        <div class="import-container">
            <div class="setup-panel">
                <v-sheet class="main-card">
                    <div class="card-header">
                        <v-icon name="cloud_upload" size="large" color="var(--primary)" />
                        <h2>นำเข้าข้อมูลสินค้า</h2>
                        <p>จัดการข้อมูลผ่านไฟล์ Excel (.csv) และรูปภาพจากเครื่อง</p>
                    </div>

                    <v-divider class="my-24" />

                    <section class="step-section">
                        <div class="step-badge">1</div>
                        <div class="step-content">
                            <div class="step-header">
                                <div class="step-title">เตรียมไฟล์ข้อมูล CSV</div>
                                <v-button icon secondary x-small @click="showGuide = true"
                                    v-tooltip="'คลิกเพื่อดูคู่มือการตกแต่งข้อความ HTML และรายละเอียดฟิลด์'">
                                    <v-icon name="help_outline" />
                                </v-button>
                            </div>
                            <p class="step-desc">กรอกข้อมูลลงใน Excel และบันทึกเป็น .csv (UTF-8)</p>

                            <div class="download-card mt-12" @click="downloadTemplate">
                                <div class="download-icon-box">
                                    <v-icon name="download" />
                                </div>
                                <div class="download-info">
                                    <div class="main-text">ดาวน์โหลด CSV Template</div>
                                    <div class="sub-text">ไฟล์ตัวอย่างที่ตั้งค่าโครงสร้างและกันข้อมูลเยื้องไว้ให้แล้ว
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <v-divider class="my-24" />

                    <section class="step-section">
                        <div class="step-badge">2</div>
                        <div class="step-content">
                            <div class="step-title">เลือกไฟล์จากเครื่อง</div>
                            <div class="file-zone mt-12">
                                <input type="file" @change="onCSVSelect" accept=".csv" id="csv-input" class="hidden" />
                                <label for="csv-input" :class="['drop-label', { 'has-file': csvFile }]">
                                    <v-icon :name="csvFile ? 'insert_drive_file' : 'post_add'" left />
                                    {{ csvFile ? csvFile.name : 'เลือกไฟล์ .csv ที่เตรียมไว้' }}
                                </label>
                            </div>
                        </div>
                    </section>

                    <v-divider class="my-24" />

                    <section class="step-section">
                        <div class="step-badge">3</div>
                        <div class="step-content">
                            <div class="step-title">เลือกรูปภาพประกอบ</div>
                            <p class="step-desc">เลือกไฟล์รูปภาพที่ระบุชื่อไว้ใน CSV (เลือกหลายไฟล์พร้อมกันได้)</p>
                            <div class="file-zone mt-12">
                                <input type="file" multiple @change="onImagesSelect" accept="image/*" id="img-input"
                                    class="hidden" />
                                <label for="img-input" :class="['drop-label', { 'has-file': localImages.length }]">
                                    <v-icon :name="localImages.length ? 'photo_library' : 'add_photo_alternate'" left />
                                    {{ localImages.length ? `เลือกรูปภาพแล้ว ${localImages.length} ไฟล์` :
                                        'คลิกเพื่อเลือกไฟล์รูปภาพ' }}
                                </label>
                            </div>
                        </div>
                    </section>

                    <v-divider class="my-24" />

                    <v-button :loading="isProcessing" :disabled="!csvFile" @click="startImport" kind="primary" block
                        size="large">
                        <v-icon name="upload" left /> เริ่มการนำเข้าข้อมูล
                    </v-button>
                </v-sheet>
            </div>

            <div class="log-panel">
                <div class="console-box">
                    <div class="console-header">
                        <div class="header-left">
                            <v-icon name="terminal" left small />
                            <span>Live Import Logs</span>
                        </div>
                        <v-chip v-if="isProcessing" x-small color="var(--primary)" animate>EXECUTING</v-chip>
                    </div>
                    <div class="console-content" ref="logContainer">
                        <div v-if="logs.length === 0" class="empty-log">รอดำเนินการ...</div>
                        <div v-for="(log, i) in logs" :key="i" :class="['log-entry', log.type]">
                            <span class="t">{{ log.time }}</span>
                            <span class="m">{{ log.msg }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <v-dialog v-model="showGuide" @esc="showGuide = false" size="xl">
                <v-card class="guide-dialog-card">
                    <v-card-title>CSV Column Guide & HTML Decorator</v-card-title>
                    <v-card-text class="scrollable-content">

                        <div class="html-cheat-sheet mb-24">
                            <h4>🎨 วิธีตกแต่งข้อความใน Description (คัดลอกไปใช้ใน Excel ได้เลย)</h4>
                            <table class="cheat-table">
                                <thead>
                                    <tr>
                                        <th style="width: 200px">ผลลัพธ์ที่ต้องการ</th>
                                        <th>โค้ดที่ต้องพิมพ์ใน Excel</th>
                                        <th>คำอธิบาย</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><strong>ข้อความตัวหนา</strong></td>
                                        <td><code>&lt;b&gt;ข้อความ&lt;/b&gt;</code></td>
                                        <td>เน้นคำสำคัญ</td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <h3 style="margin:0; color:var(--primary)">หัวข้อขนาดใหญ่</h3>
                                        </td>
                                        <td><code>&lt;h3&gt;ชื่อหัวข้อ&lt;/h3&gt;</code></td>
                                        <td>ใช้สำหรับหัวข้อหลัก (H3)</td>
                                    </tr>
                                    <tr>
                                        <td><span style="color: red">ข้อความสีแดง</span></td>
                                        <td><code>&lt;span style="color:red"&gt;ข้อความ&lt;/span&gt;</code></td>
                                        <td>เปลี่ยน red เป็นสีอื่นได้</td>
                                    </tr>
                                    <tr>
                                        <td>• รายการ 1<br>• รายการ 2</td>
                                        <td><code>&lt;ul&gt;&lt;li&gt;รายการ 1&lt;/li&gt;&lt;li&gt;รายการ 2&lt;/li&gt;&lt;/ul&gt;</code>
                                        </td>
                                        <td>ทำจุด Bullet point</td>
                                    </tr>
                                    <tr>
                                        <td><u>ข้อความขีดเส้นใต้</u></td>
                                        <td><code>&lt;u&gt;ข้อความ&lt;/u&gt;</code></td>
                                        <td>ใช้ขีดเส้นใต้ข้อความ</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div class="html-helper-box mt-12">
                                <p>💡 <strong>เคล็ดลับ:</strong> หากไม่ใส่โค้ดเลย ระบบจะแปลงการ <b>"เว้นบรรทัด"</b> ใน
                                    Excel ให้เป็นย่อหน้าปกติให้อัตโนมัติครับ</p>
                            </div>
                        </div>

                        <table class="guide-table">
                            <thead>
                                <tr>
                                    <th style="width: 150px">หัวคอลัมน์</th>
                                    <th>คำอธิบาย</th>
                                    <th style="width: 250px">ตัวอย่าง</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>name</strong></td>
                                    <td>ชื่อสินค้า (จำเป็น)</td>
                                    <td>Nivea Moisturizing Cream</td>
                                </tr>
                                <tr>
                                    <td><strong>brand_name</strong></td>
                                    <td>ชื่อยี่ห้อสินค้า</td>
                                    <td>Nivea</td>
                                </tr>
                                <tr>
                                    <td><strong>ingredients</strong></td>
                                    <td>รายชื่อส่วนผสม คั่นด้วยคอมมา (,)</td>
                                    <td>Aqua, Glycerin</td>
                                </tr>
                                <tr>
                                    <td><strong>thumbnail</strong></td>
                                    <td>ชื่อไฟล์รูปปก หรือ URL</td>
                                    <td>nivea_cover.jpg</td>
                                </tr>
                                <tr>
                                    <td><strong>illustrations</strong></td>
                                    <td>ชื่อไฟล์รูปประกอบอื่นๆ คั่นด้วยคอมมา (,)</td>
                                    <td>p1.jpg, p2.jpg</td>
                                </tr>
                                <tr>
                                    <td><strong>price</strong></td>
                                    <td>ราคาสินค้า (ตัวเลขเท่านั้น)</td>
                                    <td>1250</td>
                                </tr>
                                <tr>
                                    <td><strong>quantity</strong></td>
                                    <td>จำนวน</td>
                                    <td>50</td>
                                </tr>
                                <tr>
                                    <td><strong>skin_types</strong></td>
                                    <td>พิมพ์ไทย: ผิวมัน, ผิวแห้ง, ผิวผสม, ผิวแพ้ง่าย</td>
                                    <td>ผิวมัน, ผิวแห้ง</td>
                                </tr>
                                <tr>
                                    <td><strong>categories</strong></td>
                                    <td>หมวดหมู่ไทย (สร้างให้อัตโนมัติ)</td>
                                    <td>มอยส์เจอร์ไรเซอร์, ครีมบำรุงผิว</td>
                                </tr>
                                <tr>
                                    <td><strong>description</strong></td>
                                    <td>รายละเอียด (ใส่ HTML หรือ อัปเดตภายหลังได้)</td>
                                    <td>&lt;h3&gt;คุณสมบัติ&lt;/h3&gt;...</td>
                                </tr>
                                <tr>
                                    <td><strong>status</strong></td>
                                    <td>active / inactive</td>
                                    <td>active</td>
                                </tr>
                            </tbody>
                        </table>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer />
                        <v-button kind="primary" @click="showGuide = false">
                            เข้าใจแล้ว
                        </v-button>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </div>
    </private-view>
</template>

<script>
import { ref, nextTick } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import Papa from 'papaparse';

export default {
    setup() {
        const api = useApi();
        const csvFile = ref(null);
        const localImages = ref([]);
        const isProcessing = ref(false);
        const showGuide = ref(false);
        const logs = ref([]);
        const logContainer = ref(null);

        const onCSVSelect = (e) => csvFile.value = e.target.files[0];
        const onImagesSelect = (e) => localImages.value = Array.from(e.target.files);

        const addLog = (msg, type = 'info') => {
            const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
            logs.value.push({ time, msg, type });
            nextTick(() => {
                if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight;
            });
        };

        const formatDescription = (text) => {
            if (!text) return '';
            if (/<[a-z][\s\S]*>/i.test(text)) return text;
            return text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
        };

        const mapSkinType = (thaiString) => {
            if (!thaiString) return [];
            const mapping = { 'ผิวมัน': 'oily', 'ผิวแห้ง': 'dry', 'ผิวผสม': 'combination', 'ผิวแพ้ง่าย': 'sensitive' };
            return thaiString.split(',').map(s => s.trim()).map(s => mapping[s] || s).filter(s => ['oily', 'dry', 'combination', 'sensitive'].includes(s));
        };

        const getCategoryPayload = async (catString) => {
            if (!catString) return [];
            const names = catString.split(',').map(n => n.trim()).filter(n => n);
            const payload = [];
            for (const name of names) {
                const res = await api.get('/items/category', { params: { filter: { name: { _eq: name } }, limit: 1 } });
                let catId = res.data.data[0]?.id || (await api.post('/items/category', { name })).data.data.id;
                payload.push({ category_id: { id: catId } });
            }
            return payload;
        };

        const downloadTemplate = () => {
            const headers = ['name', 'brand_name', 'ingredients', 'thumbnail', 'illustrations', 'price', 'quantity', 'skin_types', 'categories', 'description', 'status'];
            const sampleData = [
                'Nivea Moisturizing Cream',
                'Nivea',
                'Aqua, Glycerin',
                'nivea_cover.jpg',
                'p1.jpg, p2.jpg',
                '1250',
                '50',
                'ผิวมัน, ผิวแห้ง',
                'มอยส์เจอร์ไรเซอร์, ครีมบำรุงผิว',
                '<h3>คุณสมบัติ</h3><p>ครีมบำรุงผิวให้ความชุ่มชื้นยาวนาน</p>',
                'active'
            ];

            const wrap = (val) => `"${String(val).replace(/"/g, '""')}"`;
            const csvContent = [
                headers.map(wrap).join(","),
                sampleData.map(wrap).join(",")
            ].join("\n");

            const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", "product_template.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        async function getFileId(source) {
            if (!source) return null;
            const src = source.trim();
            const localMatch = localImages.value.find(f => f.name === src);
            if (localMatch) {
                const formData = new FormData();
                formData.append('file', localMatch);
                return (await api.post('/files', formData)).data.data.id;
            }
            if (src.startsWith('http')) return (await api.post('/files/import', { url: src })).data.data.id;
            return (await api.get('/files', { params: { filter: { filename_download: { _eq: src } }, limit: 1 } })).data.data[0]?.id || null;
        }

        const startImport = () => {
            isProcessing.value = true;
            logs.value = [];
            Papa.parse(csvFile.value, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    for (const row of results.data) {
                        try {
                            addLog(`ประมวลผล: ${row.name}`);
                            
                            const existingRes = await api.get('/items/product', {
                                params: {
                                    filter: { name: { _eq: row.name } },
                                    fields: ['id'],
                                    limit: 1
                                }
                            });
                            const existingId = existingRes.data.data[0]?.id;

                            const thumbId = await getFileId(row.thumbnail);
                            const illusPayload = [];
                            if (row.illustrations) {
                                for (const src of row.illustrations.split(',')) {
                                    const fid = await getFileId(src.trim());
                                    if (fid) illusPayload.push({ directus_files_id: { id: fid } });
                                }
                            }

                            const payload = {
                                status: row.status || 'active',
                                name: row.name,
                                brand_name: row.brand_name,
                                price: parseFloat(row.price || 0),
                                quantity: row.quantity,
                                description: formatDescription(row.description),
                                suitable_skin_type: mapSkinType(row.skin_types),
                                categories: await getCategoryPayload(row.categories),
                                thumbnail: thumbId,
                                illustration: illusPayload,
                                temp_ingredients: row.ingredients
                            };

                            if (existingId) {
                                await api.patch(`/items/product/${existingId}`, payload);
                                addLog(`✅ อัปเดตข้อมูลเดิมสำเร็จ: ${row.name}`, 'success');
                            } else {
                                await api.post('/items/product', payload);
                                addLog(`✅ เพิ่มข้อมูลใหม่สำเร็จ: ${row.name}`, 'success');
                            }
                        } catch (err) { 
                            addLog(`❌ พลาด: ${row.name} (${err.message})`, 'error'); 
                        }
                    }
                    isProcessing.value = false;
                    addLog('--- จบการทำงาน ---');
                }
            });
        };

        return { csvFile, localImages, isProcessing, showGuide, logs, logContainer, onCSVSelect, onImagesSelect, startImport, downloadTemplate };
    }
};
</script>

<style scoped>
.import-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    padding: 32px;
    height: 100%;
    background-color: var(--background-subdued);
    align-items: start;
    user-select: text !important;
}

.log-panel {
    height: 550px;
}

.console-box {
    height: 100%;
    background: #1a1c1e;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #2d2f31;
}

.guide-dialog-card {
    min-width: 1200px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
}

.scrollable-content {
    overflow-y: auto;
    flex: 1;
    padding: 24px;
    user-select: text !important;
}

.console-content,
.guide-table,
.cheat-table,
code,
td,
th,
.m,
.t {
    user-select: text !important;
    cursor: text;
}

.download-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    background-color: var(--background-subdued);
    border: 1px solid var(--border-normal);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    width: 400px;
}

.download-card:hover {
    border-color: var(--primary);
    background-color: var(--primary-5);
}

.download-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: var(--primary);
    background: var(--primary-10);
    border-radius: 8px;
}

.download-info {
    display: flex;
    flex-direction: column;
}

.main-text {
    font-weight: 600;
    font-size: 14px;
    color: var(--foreground-normal);
}

.sub-text {
    font-size: 12px;
    color: var(--foreground-subdued);
    margin-top: 2px;
}

.main-card {
    padding: 32px;
    border-radius: 16px;
    border: 1px solid var(--border-normal);
    background: var(--background-normal);
}

.card-header {
    text-align: center;
    margin-bottom: 8px;
}

.card-header h2 {
    font-size: 24px;
    font-weight: 700;
    margin-top: 12px;
}

.step-section {
    display: flex;
    gap: 16px;
    align-items: flex-start;
}

.step-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
}

.step-badge {
    width: 24px;
    height: 24px;
    font-size: 12px;
    background: var(--primary-10);
    color: var(--primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex-shrink: 0;
}

.step-title {
    font-weight: 700;
    font-size: 15px;
    color: var(--foreground-normal);
}

.drop-label {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    border: 2px dashed var(--border-normal);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground-subdued);
    width: 400px;
}

.drop-label:hover {
    border-color: var(--primary);
    background: var(--primary-5);
}

.drop-label.has-file {
    border-style: solid;
    border-color: var(--green);
    background: var(--green-5);
    color: var(--green);
}

.console-header {
    background: #252729;
    padding: 12px 20px;
    border-bottom: 1px solid #36393c;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.console-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 12px;
    color: #e1e3e5;
    line-height: 1.6;
}

.log-entry {
    margin-bottom: 6px;
    display: flex;
    gap: 10px;
}

.log-entry.success .m {
    color: #98c379;
}

.log-entry.error .m {
    color: #e06c75;
}

.t {
    color: #5c6370;
}

.guide-table {
    width: 100%;
    border-collapse: collapse;
}

.guide-table th,
.guide-table td {
    padding: 12px;
    border: 1px solid var(--border-normal);
    text-align: left;
    font-size: 13px;
}

.guide-table th {
    background: var(--background-subdued);
    position: sticky;
    top: 0;
    z-index: 10;
}

.html-cheat-sheet {
    background: #f0f4f9;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #d1d9e2;
}

.cheat-table {
    width: 100%;
    background: #ffffff;
    border-collapse: collapse;
    border-radius: 8px;
    overflow: hidden;
}

.cheat-table th,
.cheat-table td {
    padding: 12px 16px;
    border: 1px solid #e2e8f0;
    font-size: 13px;
}

.cheat-table code {
    background: #fff5f5;
    color: #c53030;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-weight: bold;
}

.hidden {
    display: none;
}

.my-24 {
    margin: 24px 0;
}

.mt-12 {
    margin-top: 12px;
}

.mb-24 {
    margin-bottom: 24px;
}
</style>