<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { VacationRequest } from '@/api/vacationRequests'
import { daysBetween, daysInclusive, formatDate, todayIso, weekday } from '@/utils/dates'

/**
 * Who is away when, for one period (a month): a row per person, a column per
 * day, a bar per vacation. Approved bars are solid, Pending ones striped. A
 * vacation running past the period gets a square edge on that side.
 */
const props = defineProps<{
  from: string
  to: string
  vacations: VacationRequest[]
  selectedId?: string | null
}>()

const emit = defineEmits<{ select: [vacation: VacationRequest] }>()

const days = computed(() => daysBetween(props.from, props.to))
const today = todayIso()
const isWeekend = (day: string) => [0, 6].includes(weekday(day))

/** One row per person, alphabetical. Rule 2 guarantees a person's bars never overlap. */
const rows = computed(() => {
  const byUser = new Map<string, { id: string; name: string; vacations: VacationRequest[] }>()
  for (const vacation of props.vacations) {
    if (!vacation.user) continue
    const row = byUser.get(vacation.user.id) ?? { ...vacation.user, vacations: [] }
    row.vacations.push(vacation)
    byUser.set(vacation.user.id, row)
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name))
})

/** Grid columns: column 1 is the name, day N of the period is column N + 1. */
const gridStyle = computed(() => ({
  gridTemplateColumns: `minmax(8rem, 10rem) repeat(${days.value.length}, minmax(1.75rem, 1fr))`,
}))

function barPlacement(vacation: VacationRequest) {
  const start = vacation.startDate < props.from ? props.from : vacation.startDate
  const end = vacation.endDate > props.to ? props.to : vacation.endDate
  return {
    gridColumn: `${daysInclusive(props.from, start) + 1} / ${daysInclusive(props.from, end) + 2}`,
    continuesBefore: vacation.startDate < props.from,
    continuesAfter: vacation.endDate > props.to,
  }
}

// On narrow screens only part of the month fits: start scrolled so that today is in view.
const scroller = ref<HTMLElement>()
watch(
  () => props.from,
  async () => {
    await nextTick()
    const box = scroller.value
    if (!box) return
    box.scrollLeft = 0
    const todayCell = box.querySelector<HTMLElement>('[data-today]')
    const nameColumn = box.querySelector<HTMLElement>('.sticky')
    if (!todayCell || !nameColumn) return
    // Put today just right of the pinned names, with two earlier days still visible.
    const todayX = todayCell.getBoundingClientRect().left - box.getBoundingClientRect().left
    box.scrollLeft = todayX - nameColumn.offsetWidth - 2 * todayCell.offsetWidth
  },
  { immediate: true },
)

const STRIPES =
  'repeating-linear-gradient(135deg, rgb(251 191 36) 0 6px, rgb(254 243 199) 6px 12px)'

const label = (vacation: VacationRequest) =>
  `${vacation.user?.name}: ${formatDate(vacation.startDate)} – ${formatDate(vacation.endDate)}, ` +
  `${daysInclusive(vacation.startDate, vacation.endDate)} days, ${vacation.status}`
</script>

<template>
  <div ref="scroller" class="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
    <div class="min-w-max">
      <!-- Each bar is a button whose label says everything; the grid itself is decoration. -->
      <!-- Day header -->
      <div class="grid border-b border-gray-200 text-center text-xs" :style="gridStyle">
        <div class="sticky left-0 z-20 bg-white px-3 py-2 text-left font-medium text-gray-500">
          Person
        </div>
        <div
          v-for="day in days"
          :key="day"
          :data-today="day === today || undefined"
          class="py-2"
          :class="[
            isWeekend(day) ? 'bg-gray-50 text-gray-400' : 'text-gray-600',
            day === today ? 'font-bold text-indigo-600' : '',
          ]"
        >
          {{ Number(day.slice(8)) }}
        </div>
      </div>

      <!-- One row per person -->
      <div
        v-for="row in rows"
        :key="row.id"
        class="grid border-b border-gray-100 last:border-b-0"
        :style="gridStyle"
      >
        <div
          class="sticky left-0 z-20 truncate bg-white px-3 py-3 text-sm font-medium text-gray-900"
          style="grid-row: 1"
        >
          {{ row.name }}
        </div>

        <!-- Background: weekends shaded, today marked -->
        <div
          v-for="(day, index) in days"
          :key="day"
          aria-hidden="true"
          :style="{ gridRow: 1, gridColumn: index + 2 }"
          :class="[
            isWeekend(day) ? 'bg-gray-50' : '',
            day === today ? 'border-x border-indigo-200 bg-indigo-50/60' : '',
          ]"
        />

        <!-- Vacation bars, on top of the background -->
        <button
          v-for="vacation in row.vacations"
          :key="vacation.id"
          type="button"
          :title="label(vacation)"
          :aria-label="label(vacation)"
          :aria-pressed="vacation.id === selectedId"
          class="z-10 my-2 h-7 min-w-0 cursor-pointer shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600"
          :class="[
            vacation.status === 'Approved' ? 'bg-green-500 hover:bg-green-600' : 'ring-1 ring-amber-400 ring-inset',
            barPlacement(vacation).continuesBefore ? '' : 'ml-0.5 rounded-l-md',
            barPlacement(vacation).continuesAfter ? '' : 'mr-0.5 rounded-r-md',
            vacation.id === selectedId ? 'ring-2 ring-indigo-600 ring-offset-1' : '',
          ]"
          :style="{
            gridRow: 1,
            gridColumn: barPlacement(vacation).gridColumn,
            ...(vacation.status === 'Pending' && { background: STRIPES }),
          }"
          @click="emit('select', vacation)"
        />
      </div>

      <p v-if="rows.length === 0" class="px-4 py-8 text-center text-sm text-gray-500">
        Nobody has a vacation planned in this period.
      </p>
    </div>
  </div>
</template>
