<script setup lang="ts">
import { ref, watch } from 'vue'
import { vacationRequestsApi, type VacationPeriod, type VacationRequest } from '@/api/vacationRequests'
import { errorMessage } from '@/api/http'
import { useNotice } from '@/composables/useNotice'
import { usePagedList } from '@/composables/usePagedList'
import { daysInclusive, formatDate } from '@/utils/dates'
import AlertMessage from '@/components/AlertMessage.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import VacationRequestForm from '@/components/VacationRequestForm.vue'

/** Requester page: submit a request, see my requests, edit or cancel Pending ones. */

const PAGE_SIZE = 10

const page = ref(1)
const list = usePagedList({
  fetch: () => vacationRequestsApi.mine({ page: page.value, limit: PAGE_SIZE }),
  page,
  goToPage: (target) => (page.value = target), // the page watcher reloads
  errorText: 'Could not load your requests',
})
const { items: requests, total, loading, error: loadError } = list
watch(page, list.load, { immediate: true })

const { notice, show: showNotice } = useNotice()
function done(message: string, reload = true) {
  showNotice(message)
  if (reload) return list.load()
}

// --- create: the newest request is first, so show page 1 afterwards ---
const create = (period: VacationPeriod) => vacationRequestsApi.create(period)

function onCreated() {
  const alreadyOnFirstPage = page.value === 1
  page.value = 1 // when it changes, the page watcher reloads
  done('Request submitted.', alreadyOnFirstPage)
}

// --- edit (Pending only) ---
const editing = ref<VacationRequest | null>(null)
const editOpen = ref(false)

function startEdit(request: VacationRequest) {
  editing.value = request
  editOpen.value = true
}
const saveEdit = (period: VacationPeriod) => vacationRequestsApi.update(editing.value!.id, period)

async function onEdited() {
  editOpen.value = false
  await done('Request updated.')
}

// --- cancel (Pending only) ---
const cancelling = ref<VacationRequest | null>(null)
const cancelOpen = ref(false)
const cancelBusy = ref(false)
const cancelError = ref('')

function askCancel(request: VacationRequest) {
  cancelling.value = request
  cancelError.value = ''
  cancelOpen.value = true
}

async function confirmCancel() {
  cancelBusy.value = true
  try {
    await vacationRequestsApi.cancel(cancelling.value!.id)
    cancelOpen.value = false
    await done('Request cancelled.')
  } catch (error) {
    cancelError.value = errorMessage(error, 'Could not cancel the request')
  } finally {
    cancelBusy.value = false
  }
}

const period = (request: VacationRequest) =>
  `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`
const days = (request: VacationRequest) => daysInclusive(request.startDate, request.endDate)
</script>

<template>
  <div class="space-y-8">
    <section class="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h1 class="text-xl font-semibold text-gray-900">New vacation request</h1>
      <p class="mt-1 text-sm text-gray-600">It stays Pending until a validator approves or rejects it.</p>
      <div class="mt-6">
        <VacationRequestForm :save="create" @saved="onCreated" />
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold text-gray-900">My requests</h2>

      <AlertMessage v-if="notice" variant="success" class="mt-4">{{ notice }}</AlertMessage>
      <AlertMessage v-if="loadError" class="mt-4">{{ loadError }}</AlertMessage>

      <p v-if="loading && requests.length === 0" class="mt-4 text-sm text-gray-500">Loading…</p>
      <p v-else-if="!loadError && requests.length === 0" class="mt-4 text-sm text-gray-500">
        You have no vacation requests yet.
      </p>

      <ul v-else class="mt-4 divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <li
          v-for="request in requests"
          :key="request.id"
          class="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-gray-900">{{ period(request) }}</span>
              <span class="text-sm text-gray-500">· {{ days(request) }} days</span>
              <StatusBadge :status="request.status" />
            </div>
            <p v-if="request.reason" class="text-sm break-words text-gray-600">{{ request.reason }}</p>
            <p v-if="request.comments" class="text-sm break-words text-gray-600">
              <span class="font-medium">Validator:</span> {{ request.comments }}
            </p>
          </div>

          <div v-if="request.status === 'Pending'" class="flex shrink-0 gap-2">
            <BaseButton variant="secondary" @click="startEdit(request)">Edit</BaseButton>
            <BaseButton variant="secondary" @click="askCancel(request)">Cancel request</BaseButton>
          </div>
        </li>
      </ul>

      <PaginationBar v-model:page="page" class="mt-4" :total="total" :limit="PAGE_SIZE" noun="requests" />
    </section>

    <BaseDialog v-model:open="editOpen" title="Edit request">
      <VacationRequestForm
        v-if="editing"
        :key="editing.id"
        :save="saveEdit"
        :initial="editing"
        submit-label="Save changes"
        cancelable
        @saved="onEdited"
        @cancel="editOpen = false"
      />
    </BaseDialog>

    <ConfirmDialog
      v-model:open="cancelOpen"
      title="Cancel this request?"
      confirm-label="Cancel request"
      variant="danger"
      :loading="cancelBusy"
      :error="cancelError"
      @confirm="confirmCancel"
    >
      <template v-if="cancelling">
        Your request for {{ period(cancelling) }} will be withdrawn. This cannot be undone.
      </template>
    </ConfirmDialog>
  </div>
</template>
