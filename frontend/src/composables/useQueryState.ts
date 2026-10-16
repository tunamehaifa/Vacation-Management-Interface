import { computed, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'

/**
 * Page state kept in the URL (filters, page, month…), so a reload, the back
 * button and shared links all show the same view.
 *
 *   const { params, update } = useQueryState({ page: pageParam, status: oneOf([...], 'Pending') })
 *   params.value.page        // always valid: a broken or missing key gets its fallback
 *   update({ page: 2 })      // a new history entry; { replace: true } for none
 *
 * Missing or broken keys are corrected in the URL right away, without an
 * extra history entry. A key whose value is null is left out of the URL.
 */
export interface QueryParam<T> {
  /** The value for a URL string, or null when it is not valid. */
  parse: (raw: string) => T | null
  /** Used when the key is missing or invalid; null leaves the key out. */
  fallback: () => T
  /** How the value is written to the URL (default: String). */
  serialize?: (value: T) => string
}

type Values<S> = { [K in keyof S]: S[K] extends QueryParam<infer T> ? T : never }

export function useQueryState<S extends Record<string, QueryParam<any>>>(schema: S) {
  const route = useRoute()
  const router = useRouter()
  const routeName = route.name // the page this state belongs to

  const read = (key: keyof S) => {
    const raw = route.query[key as string]
    const parsed = typeof raw === 'string' ? schema[key]!.parse(raw) : null
    return parsed ?? schema[key]!.fallback()
  }
  const write = (key: keyof S, value: unknown) =>
    value === null ? undefined : (schema[key]!.serialize ?? String)(value)

  const params = computed(
    () => Object.fromEntries(Object.keys(schema).map((key) => [key, read(key)])) as Values<S>,
  )

  function update(changes: Partial<Values<S>>, { replace = false } = {}) {
    const query: LocationQueryRaw = { ...route.query }
    for (const key of Object.keys(schema) as (keyof S)[]) {
      const value = key in changes ? changes[key] : params.value[key]
      const text = write(key, value)
      if (text === undefined) delete query[key as string]
      else query[key as string] = text
    }
    return replace ? router.replace({ query }) : router.push({ query })
  }

  // Correct the URL when a key is missing or does not match its parsed value.
  watch(
    () => route.query,
    () => {
      if (route.name !== routeName) return // leaving the page
      const wrong = Object.keys(schema).some((key) => {
        const expected = write(key, params.value[key as keyof S])
        return (route.query[key] ?? undefined) !== expected
      })
      if (wrong) update({}, { replace: true })
    },
    { immediate: true },
  )

  return { params, update }
}

// --- common parameters ---

export const pageParam: QueryParam<number> = {
  parse: (raw) => (/^[1-9]\d*$/.test(raw) ? Number(raw) : null),
  fallback: () => 1,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** An optional id: left out of the URL when absent or malformed. */
export const idParam: QueryParam<string | null> = {
  parse: (raw) => (UUID.test(raw) ? raw : null),
  fallback: () => null,
}

/** One of a fixed list of values. */
export const oneOf = <T extends string>(values: readonly T[], fallback: T): QueryParam<T> => ({
  parse: (raw) => values.find((value) => value === raw) ?? null,
  fallback: () => fallback,
})
