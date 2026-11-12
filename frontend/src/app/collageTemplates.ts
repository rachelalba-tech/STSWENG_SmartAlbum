// one cell = one image on the collage 
export interface Cell{
    col: number
    row: number
    colSpan?: number
    rowSpan?: number
}

export interface CollageTemplate {
    id: string
    name: string
    cols: number 
    rows: number 
    cells: Cell[]
} 

export const TEMPLATES: CollageTemplate[] = [
    // Collage 1 - Grid with 9 images equally sized  
    {
        id: "grid-9", name: "Nine grid", cols: 3, rows: 3, 
        cells: Array.from({ length: 9}, (_, i) => ({ col: (i % 3) + 1, row: Math.floor(i / 3) + 1})), 
    }, 
    // Collage 2 - 6 images with one large featured image on the top left 
    {
        id: "top-left-feature", name: "Top left feature", cols: 3, rows: 3, 
        cells: [
            {col: 1, row: 1, colSpan: 2, rowSpan: 2},
            {col: 3, row: 1}, {col: 3, row: 2}, 
            {col: 1, row: 3}, {col: 2, row: 3}, {col: 3, row: 3}, 
        ],
    },
    // Collage 3 - 6 images with one large featured image on the top right 
    {
        id: "top-right-feature", name: "Top right feature", cols: 3, rows: 3, 
        cells: [ 
            {col: 1, row: 1}, 
            {col: 2, row: 1, colSpan: 2, rowSpan: 2},
            {col: 1, row: 2},
            {col: 1, row: 3}, {col: 2, row: 3}, {col: 3, row: 3},  
        ],
    },
    // Collage 4 - 2 images on top of 1 long image 
    {
        id: "two-over-one", name: "Two over one", cols: 2, rows: 2,
        cells: [
            {col: 1, row: 1}, {col: 2, row: 1}, 
            {col: 1, row: 2, colSpan: 3} 
        ],
    },
    // Collage 5 - 6 images with one large featured image on the bottom left 
    {
        id: "bottom-left-feature", name: "Bottom left feature", cols: 3, rows: 3, 
        cells: [
            {col: 1, row: 1}, {col: 2, row: 1}, {col: 3, row: 1}, 
            {col: 1, row: 2, colSpan: 2, rowSpan: 2}, {col: 3, row: 2}, 
            {col: 1, row: 3}, 
        ], 
    },
    // Collage 6 - 6 images with one large featured image on the bottom right
    {
        id: "bottom-right-feature", name: "Bottom right feature", cols: 3, rows: 3, 
        cells: [
            {col: 1, row: 1}, {col: 2, row: 1}, {col: 3, row: 1}, 
            {col: 1, row: 2}, {col: 2, row: 2, colSpan: 2, rowSpan: 2}, 
            {col: 1, row: 3}, 
        ],
    },
    // Collage 7 - mosaic collage 
    {
        id: "mosaic", name: "Mosaic", 
        cols: 3, rows: 3,
        cells: [
            {col: 1, row: 1, colSpan: 2}, {col: 2, row: 1}, {col: 3, row: 1}, 
            {col: 2, row: 2}, {col: 3, row: 2, colSpan: 2}, 
            {col: 1, row: 3}, {col: 2, row: 3}, 
        ],
    },
    // Collage 8 - four picture grid 
    {
        id: "grid-4", name: "Four grid", 
        cols: 2, rows: 2, 
        cells: [ 
            {col: 1, row: 1}, {col: 2, row: 1},
            {col: 1, row: 2}, {col: 2, row: 2},
        ],
    },
    // Collage 9 - one picture over three
    {
        id: "one-over-three", name: "One over three", 
        cols: 3, rows: 2, 
        cells: [
            {col: 1, row: 1},
            {col: 1, row: 2}, {col: 2, row: 2}, {col: 3, row: 2}, 
        ],
    }
]

// Ensures that templates fit the num of photos 
export const templatesFor = (count: number) => TEMPLATES.filter((t) => t.cells.length === count) 

// Supported number of photos 
export const supportedCounts = () => 
[...new Set(TEMPLATES.map((t) => t.cells.length))].sort((a, b) => a - b)