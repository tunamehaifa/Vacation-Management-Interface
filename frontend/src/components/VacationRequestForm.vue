<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { VacationPeriod } from '@/api/vacationRequests'
import { errorMessage, fieldErrors } from '@/api/http'
import { addDays, daysInclusive, todayIso } from '@/utils/dates'
import AlertMessage from './AlertMessage.vue'
import BaseButton from './BaseButton.vue'
import FormField from './FormField.vue'

/**
 * Start date, end date and an optional reason. Used both to submit a new
 * request and to edit a Pending one: the parent passes `save`, which calls
 * the API; this form validates, shows the API's errors and reports success.
 *
 * The checks here mirror the backend rules only to give instant feedback;
 * the backend still enforces every rule.
 */
const props = withDefaults(
  defineProps<{
    save: (period: VacationPeriod) => Promise<unknown>
    initial?: VacationPeriod
    submitLabel?: string
    cancelable?: boolean
  }>(),
  { submitLabel: 'Submit request', cancelable: false },
)

const emit = defineEmits<{ saved: []; cancel: [] }>()

// The inputs hold plain strings; an empty reason becomes null when saving.
const blank = () => ({ startDate: '', endDate: '', reason: '' })
const form = reactive({
  startDate: props.initial?.startDate ?? '',
  endDate: props.initial?.endDate ?? '',
  reason: props.initial?.reason ?? '',
})
const errors = ref<Record<string, string>>({})
const generalError = ref('')
const saving = ref(false)

// Editing a field clears its error; the rest stay until the next submit.
for (const field of ['startDate', 'endDate', 'reason'] as const) {
  watch(
    () => form[field],
    () => delete errors.value[field],
  )
}

const today = todayIso()
// The end date must be after the start date (rule 1), so its minimum is the next day.
const minEndDate = computed(() => (form.startDate ? addDays(form.startDate, 1) : addDays(today, 1)))
const length = computed(() =>
  form.startDate && form.endDate && form.endDate > form.startDate
    ? daysInclusive(form.startDate, form.endDate)
    : 0,
)

function validate(): boolean {
  const found: Record<string, string> = {}
  if (!form.startDate) found.startDate = 'Required'
  else if (form.startDate < today) found.startDate = 'Must be today or later'
  if (!form.endDate) found.endDate = 'Required'
  else if (form.startDate && form.endDate <= form.startDate) found.endDate = 'Must be after the start date'
  errors.value = found
  return Object.keys(found).length === 0
}

async function submit() {
  generalError.value = ''
  if (!validate()) return

  saving.value = true
  try {
    await props.save({ startDate: form.startDate, endDate: form.endDate, reason: form.reason.trim() || null })
    Object.assign(form, blank())
    errors.value = {}
    emit('saved')
  } catch (error) {
    errors.value = fieldErrors(error)
    generalError.value = errorMessage(error, 'Could not save the request')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <AlertMessage v-if="generalError">{{ generalError }}</AlertMessage>

    <div class="grid gap-4 sm:grid-cols-2">
      <FormField
        v-model="form.startDate"
        label="Start date"
        type="date"
        required
        :min="today"
        :error="errors.startDate"
      />
      <FormField
        v-model="form.endDate"
        label="End date"
        type="date"
        required
        :min="minEndDate"
        :error="errors.endDate"
        :hint="length ? `${length} days, both dates included` : undefined"
      />
    </div>

    <FormField
      v-model="form.reason"
      label="Reason"
      multiline
      maxlength="500"
      placeholder="Optional"
      :error="errors.reason"
    />

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <BaseButton v-if="cancelable" variant="secondary" :disabled="saving" @click="emit('cancel')">
        Back
      </BaseButton>
      <BaseButton type="submit" :loading="saving">{{ submitLabel }}</BaseButton>
    </div>
  </form>
</template>
