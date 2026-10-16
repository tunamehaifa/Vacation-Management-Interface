<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/http'
import { usersApi, type UserSummary } from '@/api/users'
import { vacationRequestsApi, type VacationRequest, type VacationRequestStatus } from '@/api/vacationRequests'
import { useNotice } from '@/composables/useNotice'
import { usePagedList } from '@/composables/usePagedList'
import { idParam, oneOf, pageParam, useQueryState } from '@/composables/useQueryState'
import AlertMessage from '@/components/AlertMessage.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import RequestsTable from '@/components/RequestsTable.vue'
import ReviewDialog, { type ReviewMode } from '@/components/ReviewDialog.vue'

/**
 * Validator dashboard: every request, filtered by status and employee, with
 * Approve / Reject. The filters, the page and an opened request live in the URL
 * (/dashboard?status=Pending&user=…&page=2&request=…).
 */

const PAGE_SIZE = 10
const STATUSES = ['Pending', 'Approved', 'Rejected', 'All'] as const
type StatusFilter = (typeof STATUSES)[number]

const route = useRoute()
// The Pending ones are the validator's to-do list, so they come first.
const { params, update } = useQueryState({
  status: oneOf(STATUSES, 'Pending'),
  user: idParam,
  page: pageParam,
  request: idParam,
})
const status = computed(() => params.value.status)
const userId = computed(() => params.value.user)

// --- the list ---

const list = usePagedList({
  fetch: () =>
    vacationRequestsApi.list(
      {
        status: status.value === 'All' ? undefined : (status.value as VacationRequestStatus),
        userId: userId.value ?? undefined,
      },
      { page: params.value.page, limit: PAGE_SIZE },
    ),
  page: computed(() => params.value.page),
  goToPage: (page) => update({ page }, { replace: true }),
  errorText: 'Could not load the requests',
})
const { items: requests, total, loading, error: loadError } = list

watch(
  () => [params.value.status, params.value.user, params.value.page],
  () => {
    if (route.name === 'dashboard') list.load()
  },
  { immediate: true },
)

// A new filter starts again at page 1.
const setStatus = (value: StatusFilter) => update({ status: value, page: 1 })
const setUser = (value: string) => update({ user: value || null, page: 1 })

// The employee filter lists requesters; without it the dashboard still works.
const people = ref<UserSummary[]>([])
usersApi
  .list('Requester')
  .then((users) => (people.value = users))
  .catch(() => {})

// --- decisions ---

const reviewing = ref<VacationRequest | null>(null)
const reviewMode = ref<ReviewMode>('view')
const reviewOpen = ref(false)
const reviewError = ref('')

function review(request: VacationRequest, mode: ReviewMode) {
  reviewing.value = request
  reviewMode.value = mode
  reviewOpen.value = true
}

// ?request=<id> (e.g. "Review on dashboard" on the Team page) opens that request,
// wherever it is in the list.
watch(
  () => params.value.request,
  async (id) => {
    if (!id || reviewing.value?.id === id) return
    reviewError.value = ''
    try {
      review(await vacationRequestsApi.get(id), 'view')
    } catch (error) {
      reviewError.value = errorMessage(error, 'Could not open that request')
      update({ request: null }, { replace: true })
    }
  },
  { immediate: true },
)

// Closing always refreshes the list: it shows the decision, or one another validator made meanwhile.
watch(reviewOpen, (isOpen) => {
  if (isOpen) return
  reviewing.value = null
  if (params.value.request) update({ request: null }, { replace: true })
  list.load()
})

const { notice, show: showNotice } = useNotice()

// --- display ---

const emptyText = computed(() =>
  status.value === 'Pending' && !userId.value
    ? 'No pending requests — all caught up.'
    : 'No requests match these filters.',
)

const tabClass = (value: StatusFilter) =>
  value === status.value
    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
    : 'text-gray-600 hover:text-gray-900'
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Vacation requests</h1>
      <p class="mt-1 text-sm text-gray-600">Approve or reject what your team has asked for.</p>
    </div>

    <!-- Filters -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex overflow-x-auto rounded-lg bg-gray-100 p-1" role="group" aria-label="Status">
        <button
          v-for="value in STATUSES"
          :key="value"
          type="button"
          :class="tabClass(value)"
          class="rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap"
          :aria-pressed="value === status"
          @click="setStatus(value)"
        >
          {{ value }}
        </button>
      </div>
      <label class="flex items-center gap-2 text-sm text-gray-700">
        <span class="shrink-0">Employee</span>
        <select
          :value="userId ?? ''"
          class="block w-full rounded-md border-0 py-2 pr-8 pl-3 text-sm text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset focus:ring-2 focus:ring-indigo-600 sm:w-56"
          @change="setUser(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Everyone</option>
          <option v-for="person in people" :key="person.id" :value="person.id">{{ person.name }}</option>
        </select>
      </label>
    </div>

    <AlertMessage v-if="notice" variant="success">{{ notice }}</AlertMessage>
    <AlertMessage v-if="reviewError">{{ reviewError }}</AlertMessage>
    <AlertMessage v-if="loadError">{{ loadError }}</AlertMessage>

    <div :class="{ 'opacity-60 transition-opacity': loading }" :aria-busy="loading">
      <p v-if="loading && requests.length === 0" class="text-sm text-gray-500">Loading…</p>
      <p v-else-if="!loadError && requests.length === 0" class="text-sm text-gray-500">{{ emptyText }}</p>
      <RequestsTable
        v-else
        :requests="requests"
        @approve="review($event, 'approve')"
        @reject="review($event, 'reject')"
      />

      <PaginationBar
        :page="params.page"
        class="mt-4"
        :total="total"
        :limit="PAGE_SIZE"
        noun="requests"
        @update:page="update({ page: $event })"
      />
    </div>

    <ReviewDialog v-model:open="reviewOpen" :request="reviewing" :mode="reviewMode" @decided="showNotice" />
  </div>
</template>
