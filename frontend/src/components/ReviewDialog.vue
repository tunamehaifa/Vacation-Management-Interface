<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { errorMessage, fieldErrors } from '@/api/http'
import { vacationRequestsApi, type VacationRequest } from '@/api/vacationRequests'
import { daysInclusive, formatDate } from '@/utils/dates'
import AlertMessage from './AlertMessage.vue'
import BaseButton from './BaseButton.vue'
import BaseDialog from './BaseDialog.vue'
import FormField from './FormField.vue'
import StatusBadge from './StatusBadge.vue'

/**
 * The validator's decision on one request.
 * - mode "view": its details, with Approve / Reject when it is still Pending
 *   (opened from a link, e.g. the Team page);
 * - mode "approve": "Approve this request?";
 * - mode "reject": asks for the required comment.
 */
export type ReviewMode = 'view' | 'approve' | 'reject'

const props = defineProps<{ request: VacationRequest | null; mode: ReviewMode }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ decided: [message: string] }>()

const current = ref<ReviewMode>('view')
const comment = ref('')
const commentError = ref('')
const error = ref('')
const busy = ref(false)

// Every opening starts clean, in the mode the caller asked for.
watch(open, (isOpen) => {
  if (!isOpen) return
  current.value = props.mode
  comment.value = ''
  commentError.value = ''
  error.value = ''
})
watch(comment, () => (commentError.value = ''))

const title = computed(
  () =>
    ({ view: 'Vacation request', approve: 'Approve this request?', reject: 'Reject this request' })[
      current.value
    ],
)

// Back from a confirmation returns to the details when they were shown first.
function back() {
  error.value = ''
  if (props.mode === 'view' && current.value !== 'view') current.value = 'view'
  else open.value = false
}

const who = (request: VacationRequest) => request.user?.name ?? 'the employee'

async function decide() {
  const request = props.request!
  if (current.value === 'reject' && !comment.value.trim()) {
    commentError.value = 'A comment is required'
    return
  }
  busy.value = true
  error.value = ''
  try {
    if (current.value === 'approve') {
      await vacationRequestsApi.approve(request.id)
      emit('decided', `Request from ${who(request)} approved.`)
    } else {
      await vacationRequestsApi.reject(request.id, comment.value.trim())
      emit('decided', `Request from ${who(request)} rejected.`)
    }
    open.value = false
  } catch (failure) {
    commentError.value = fieldErrors(failure).comment ?? ''
    if (!commentError.value) error.value = errorMessage(failure, 'Could not save the decision')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseDialog v-model:open="open" :title="title">
    <template v-if="request">
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt class="text-gray-500">Employee</dt>
        <dd class="font-medium text-gray-900">{{ request.user?.name }}</dd>
        <dt class="text-gray-500">Period</dt>
        <dd class="text-gray-900">
          {{ formatDate(request.startDate) }} – {{ formatDate(request.endDate) }} ·
          {{ daysInclusive(request.startDate, request.endDate) }} days
        </dd>
        <dt class="text-gray-500">Reason</dt>
        <dd class="break-words text-gray-900">{{ request.reason || '—' }}</dd>
        <dt class="text-gray-500">Status</dt>
        <dd><StatusBadge :status="request.status" /></dd>
        <template v-if="request.comments">
          <dt class="text-gray-500">Comment</dt>
          <dd class="break-words text-gray-900">{{ request.comments }}</dd>
        </template>
      </dl>

      <form v-if="current === 'reject'" class="mt-4" novalidate @submit.prevent="decide">
        <FormField
          v-model="comment"
          label="Comment for the employee"
          multiline
          required
          maxlength="1000"
          placeholder="Why it cannot be approved"
          :error="commentError"
        />
      </form>

      <AlertMessage v-if="error" class="mt-4">{{ error }}</AlertMessage>

      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <template v-if="current === 'view'">
          <BaseButton variant="secondary" @click="open = false">Close</BaseButton>
          <template v-if="request.status === 'Pending'">
            <BaseButton variant="danger" @click="current = 'reject'">Reject…</BaseButton>
            <BaseButton @click="current = 'approve'">Approve…</BaseButton>
          </template>
        </template>
        <template v-else>
          <BaseButton variant="secondary" :disabled="busy" @click="back">Back</BaseButton>
          <BaseButton v-if="current === 'approve'" :loading="busy" @click="decide">Approve</BaseButton>
          <BaseButton v-else variant="danger" :loading="busy" @click="decide">Reject</BaseButton>
        </template>
      </div>
    </template>
  </BaseDialog>
</template>
