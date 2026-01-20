<template>
    <v-menu ref="dateTimeMenu" :close-on-content-click="false" attached :disabled="disabled" full-height seamless>
        <template #activator="{ toggle, active }">
            <v-input
                class="agm-date-picker"
                :active="active"
                clickable
                readonly
                :model-value="displayValue"
                :disabled="disabled"
                :placeholder="placeholder"
                @click="toggle"
            >
                <template v-if="!disabled" #append>
                    <v-icon
                        :name="value ? 'clear' : 'today'"
                        :class="{ active, 'clear-icon': value, 'today-icon': !value }"
                        @click.stop="value ? unsetValue($event) : toggle()"
                    />
                </template>
            </v-input>
        </template>

        <v-date-picker
            :type="type"
            :disabled="disabled"
            :include-seconds="includeSeconds"
            :use-24="use24"
            :model-value="value"
            :max="max" 
            @update:model-value="onInput"
            @close="dateTimeMenu?.deactivate"
        />
    </v-menu>
</template>

<script setup>
import { isValid, parse, parseISO, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { computed, ref, watch } from 'vue';

const props = defineProps({
    value: { type: String, default: null },
    type: { type: String, default: 'date' },
    disabled: { type: Boolean, default: false },
    includeSeconds: { type: Boolean, default: false },
    use24: { type: Boolean, default: true },
    placeholder: { type: String, default: 'กรุณาระบุวันที่' },
    max: { type: String, default: null } 
});

const emit = defineEmits(['input']);
const dateTimeMenu = ref();
const displayValue = ref(null);

const isValidValue = computed(() => {
    if (!props.value) return false;
    return isValid(parseValue(props.value));
});

watch(() => props.value, setDisplayValue, { immediate: true });

function onInput(newValue) {
    emit('input', newValue);
}

function setDisplayValue() {
    if (!props.value || !isValidValue.value) {
        displayValue.value = null;
        return;
    }
    const timeFormat = props.includeSeconds ? 'HH:mm:ss' : 'HH:mm';
    let formatString;
    switch (props.type) {
        case 'date': formatString = 'yyyy-MM-dd'; break;
        case 'time': formatString = timeFormat; break;
        default: formatString = `yyyy-MM-dd ${timeFormat}`;
    }
    const date = parseValue(props.value);
    const bangkokDate = toZonedTime(date, 'Asia/Bangkok');
    displayValue.value = format(bangkokDate, formatString);
}

function parseValue(value) {
    if (!value) return new Date();
    switch (props.type) {
        case 'date': return parse(value, 'yyyy-MM-dd', new Date());
        case 'time': return parse(value, 'HH:mm:ss', new Date());
        case 'timestamp': return parseISO(value);
        default: return new Date();
    }
}

function unsetValue(e) {
    e.preventDefault();
    e.stopPropagation();
    emit('input', null);
}
</script>

<style lang="scss" scoped>
.v-icon {
    &.today-icon:hover, &.today-icon.active { --v-icon-color: var(--primary); }
    &.clear-icon:hover, &.clear-icon.active { --v-icon-color: var(--danger); }
}
</style>