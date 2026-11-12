import { expect, test } from "vitest"
import {
  TEMPLATES,
  templatesFor,
  supportedCounts,
} from "../src/app/collageTemplates.ts"

test("defines collage templates", () => {
  expect(TEMPLATES.length).toBeGreaterThan(0)

  for (const template of TEMPLATES) {
    expect(template.id).toBeTruthy()
    expect(template.name).toBeTruthy()
    expect(template.cols).toBeGreaterThan(0)
    expect(template.rows).toBeGreaterThan(0)
    expect(template.cells.length).toBeGreaterThan(0)
  }
})

test("every template has a unique id", () => {
  const ids = TEMPLATES.map((template) => template.id)

  expect(new Set(ids).size).toBe(ids.length)
})

test("every cell has a valid grid position", () => {
  for (const template of TEMPLATES) {
    for (const cell of template.cells) {
      expect(cell.col).toBeGreaterThanOrEqual(1)
      expect(cell.col).toBeLessThanOrEqual(template.cols)
      expect(cell.row).toBeGreaterThanOrEqual(1)
      expect(cell.row).toBeLessThanOrEqual(template.rows)

      if (cell.colSpan !== undefined) {
        expect(cell.colSpan).toBeGreaterThan(0)
      }

      if (cell.rowSpan !== undefined) {
        expect(cell.rowSpan).toBeGreaterThan(0)
      }
    }
  }
})

test("templatesFor returns only templates with the requested number of cells", () => {
  for (const count of supportedCounts()) {
    const matches = templatesFor(count)

    expect(matches.length).toBeGreaterThan(0)
    expect(matches.every((template) => template.cells.length === count)).toBe(true)
  }
})

test("templatesFor returns an empty array when no template matches", () => {
  expect(templatesFor(0)).toEqual([])
  expect(templatesFor(1)).toEqual([])
  expect(templatesFor(2)).toEqual([])
  expect(templatesFor(5)).toEqual([])
  expect(templatesFor(8)).toEqual([])
})

test("returns the nine-photo grid for a count of nine", () => {
  const matches = templatesFor(9)

  expect(matches).toHaveLength(1)
  expect(matches[0].id).toBe("grid-9")
  expect(matches[0].cells).toHaveLength(9)
})

test("returns all four six-photo feature layouts", () => {
  const matches = templatesFor(6)

  expect(matches.map((template) => template.id)).toEqual([
    "top-left-feature",
    "top-right-feature",
    "bottom-left-feature",
    "bottom-right-feature",
  ])
})

test("returns both four-photo layouts", () => {
  const matches = templatesFor(4)

  expect(matches.map((template) => template.id)).toEqual([
    "grid-4",
    "one-over-three",
  ])
})

test("returns supported photo counts in ascending order without duplicates", () => {
  expect(supportedCounts()).toEqual([3, 4, 6, 7, 9])
})

test("supported counts correspond to the cell counts defined in the templates", () => {
  const expectedCounts = [
    ...new Set(TEMPLATES.map((template) => template.cells.length)),
  ].sort((a, b) => a - b)

  expect(supportedCounts()).toEqual(expectedCounts)
})
