<script setup lang="ts">
import { isOverdue, type VacationRequest } from '@/api/vacationRequests'
import { daysInclusive, formatDate, todayIso } from '@/utils/dates'
import BaseButton from './BaseButton.vue'
import StatusBadge from './StatusBadge.vue'

/**
 * The validator's list of requests: a table on wide screens, one card per
 * request on phones. Pending rows get Approve / Reject; the parent opens the dialog.
 */
defineProps<{ requests: VacationRequest[] }>()
const emit = defineEmits<{ approve: [request: VacationRequest]; reject: [request: VacationRequest] }>()

const period = (request: VacationRequest) =>
  `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`
const days = (request: VacationRequest) => daysInclusive(request.startDate, request.endDate)
const overdue = (request: VacationRequest) => isOverdue(request, todayIso())
</script>

<template>
  <!-- Phones: one card per request -->
  <ul class="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 md:hidden">
    <li v-for="request in requests" :key="request.id" class="space-y-2 p-4">
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium text-gray-900">{{ request.user?.name }}</span>
        <StatusBadge :status="request.status" />
      </div>
      <p class="text-sm text-gray-700">{{ period(request) }} · {{ days(request) }} days</p>
      <p v-if="request.reason" class="text-sm break-words text-gray-600">{{ request.reason }}</p>
      <p v-if="request.comments" class="text-sm break-words text-gray-600">
        <span class="font-medium">Comment:</span> {{ request.comments }}
      </p>
      <p v-if="overdue(request)" class="text-sm text-amber-700">Start date has passed: it can only be rejected.</p>
      <div v-if="request.status === 'Pending'" class="flex gap-2 pt-1">
        <BaseButton class="flex-1" :disabled="overdue(request)" @click="emit('approve', request)">Approve</BaseButton>
        <BaseButton class="flex-1" variant="secondary" @click="emit('reject', request)">Reject</BaseButton>
      </div>
    </li>
  </ul>

  <!-- Wider screens: a table -->
  <div class="hidden overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 md:block">
    <table class="min-w-full divide-y divide-gray-200 text-sm">
      <thead class="bg-gray-50 text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
        <tr>
          <th scope="col" class="px-4 py-3">Employee</th>
          <th scope="col" class="px-4 py-3">Period</th>
          <th scope="col" class="px-4 py-3 text-right">Days</th>
          <th scope="col" class="px-4 py-3">Reason</th>
          <th scope="col" class="px-4 py-3">Status</th>
          <th scope="col" class="px-4 py-3"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
        <tr v-for="request in requests" :key="request.id" class="align-top">
          <td class="px-4 py-3 font-medium whitespace-nowrap text-gray-900">{{ request.user?.name }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-gray-700">{{ period(request) }}</td>
          <td class="px-4 py-3 text-right text-gray-700 tabular-nums">{{ days(request) }}</td>
          <td class="max-w-xs px-4 py-3 break-words text-gray-600">{{ request.reason || '—' }}</td>
          <td class="max-w-xs px-4 py-3">
            <StatusBadge :status="request.status" />
            <p v-if="request.comments" class="mt-1 break-words text-gray-600">{{ request.comments }}</p>
            <p v-if="overdue(request)" class="mt-1 text-xs text-amber-700">
              Start date has passed: it can only be rejected.
            </p>
          </td>
          <td class="px-4 py-3">
            <div v-if="request.status === 'Pending'" class="flex justify-end gap-2">
              <BaseButton :disabled="overdue(request)" @click="emit('approve', request)">Approve</BaseButton>
              <BaseButton variant="secondary" @click="emit('reject', request)">Reject</BaseButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
