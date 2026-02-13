"use client"

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { Plus, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import QRFormSheet from "@/components/qr-form-sheet"
import QRSuccessDialog from "@/components/qr-success-dialog"
import QRQuizBuilder from "@/components/qr-quiz-builder"

interface QRMapping {
  classVal: string
  program: string
  subject: string
  phase: string
  chapterId: string
  chapterName?: string
  isContentReady: boolean
  fallbackProgram?: string
  fallbackPhase?: string
  fallbackChapterId?: string
}

interface QRData {
  id: string
  name: string
  url: string
  qrType?: "chapter" | "quiz"
  quizId?: string
  // New multi-mapping structure
  mappings?: QRMapping[]
  // Backward-compat single-target fields
  class?: string
  program?: string
  subject?: string
  phase?: string
  chapterId?: string
  chapterName?: string
  isContentReady?: boolean
}

interface CMSPanelProps {
  qrDatabase: QRData[]
  setQrDatabase: (data: QRData[]) => void
  quizDatabase: any[]
  setQuizDatabase: (data: any[]) => void
}

interface BookStockRecord {
  id: string
  classVal: string
  group?: string
  program: string
  availableStock: number
}

export default function CMSPanel({ qrDatabase, setQrDatabase, quizDatabase, setQuizDatabase }: CMSPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [editingQR, setEditingQR] = useState<QRData | null>(null)
  const [currentQR, setCurrentQR] = useState<QRData | null>(null)
  const [activeMenu, setActiveMenu] = useState<"generate" | "quiz" | "stock" | "access">("generate")
  const [search, setSearch] = useState("")

  // --- Book Stock Management state ---
  const [bookStock, setBookStock] = useState<BookStockRecord[]>([
    {
      id: "c9-science-ssc-ap-2027",
      classVal: "Class 9",
      group: "SCI",
      program: "Class 9 - AP - SSC Batch",
      availableStock: 1500,
    },
    {
      id: "c10-science-ssc-ap-2026",
      classVal: "Class 10",
      group: "SCI",
      program: "Class 10 - AP - SSC Batch",
      availableStock: 850,
    },
  ])
  const [stockFilterClass, setStockFilterClass] = useState<string>("all")
  const [stockFilterGroup, setStockFilterGroup] = useState<string>("all")
  const [stockFilterProgram, setStockFilterProgram] = useState<string>("all")

  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false)
  const [editingStock, setEditingStock] = useState<BookStockRecord | null>(null)
  const [stockClass, setStockClass] = useState<string>("")
  const [stockGroup, setStockGroup] = useState<string>("")
  const [stockProgram, setStockProgram] = useState<string>("")
  const [stockQuantity, setStockQuantity] = useState<string>("")
  const [stockPage, setStockPage] = useState<number>(1)
  const [stockPageSize, setStockPageSize] = useState<number>(10)

  const CLASS_OPTIONS = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"]
  const GROUP_CLASSES = new Set(["Class 9", "Class 10", "Class 11", "Class 12"])
  const GROUP_OPTIONS = ["SCI", "BS", "HUM"]

  const PROGRAM_OPTIONS: Record<string, string[]> = {
    "Class 6": ["Class 6 - AP - SSC Batch"],
    "Class 7": ["Class 7 - AP - SSC Batch"],
    "Class 8": ["Class 8 - AP - SSC Batch"],
    "Class 9": ["Class 9 - AP - SSC Batch"],
    "Class 10": ["Class 10 - AP - SSC Batch"],
    "Class 11": ["Class 11 - AP - SSC Batch"],
    "Class 12": ["Class 12 - AP - SSC Batch"],
  }

  const availableProgramsForSelectedClass = useMemo(() => {
    if (!stockClass) return []
    const predefined = PROGRAM_OPTIONS[stockClass] ?? []
    const fromExisting = Array.from(
      new Set(bookStock.filter((s) => s.classVal === stockClass).map((s) => s.program)),
    )
    return Array.from(new Set([...predefined, ...fromExisting]))
  }, [stockClass, bookStock])

  const filteredBookStock = useMemo(() => {
    return bookStock.filter((record) => {
      if (stockFilterClass !== "all" && record.classVal !== stockFilterClass) return false
      if (stockFilterGroup !== "all" && (record.group || "N/A") !== stockFilterGroup) return false
      if (stockFilterProgram !== "all" && record.program !== stockFilterProgram) return false
      return true
    })
  }, [bookStock, stockFilterClass, stockFilterGroup, stockFilterProgram])

  const totalStockPages = useMemo(() => {
    if (filteredBookStock.length === 0) return 1
    return Math.max(1, Math.ceil(filteredBookStock.length / stockPageSize))
  }, [filteredBookStock.length, stockPageSize])

  const paginatedBookStock = useMemo(() => {
    const safePage = Math.min(stockPage, totalStockPages)
    const start = (safePage - 1) * stockPageSize
    return filteredBookStock.slice(start, start + stockPageSize)
  }, [filteredBookStock, stockPage, stockPageSize, totalStockPages])

  const stockPageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = []
    const maxToShow = 5

    if (totalStockPages <= maxToShow) {
      for (let i = 1; i <= totalStockPages; i++) {
        pages.push(i)
      }
      return pages
    }

    // Always show first page
    pages.push(1)

    const showLeftEllipsis = stockPage > 3
    const showRightEllipsis = stockPage < totalStockPages - 2

    if (showLeftEllipsis) {
      pages.push("ellipsis")
    }

    const start = Math.max(2, stockPage - 1)
    const end = Math.min(totalStockPages - 1, stockPage + 1)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (showRightEllipsis) {
      pages.push("ellipsis")
    }

    // Always show last page
    pages.push(totalStockPages)

    return pages
  }, [stockPage, totalStockPages])

  // --- Manage User Access via CSV state ---
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [csvStatus, setCsvStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [csvFileName, setCsvFileName] = useState<string | null>(null)

  const handleAddNew = () => {
    setEditingQR(null)
    setIsFormOpen(true)
  }

  const handleEdit = (qr: QRData) => {
    setEditingQR(qr)
    setIsFormOpen(true)
  }

  const handleSubmit = (qrData: QRData) => {
    if (editingQR) {
      setQrDatabase(qrDatabase.map((qr) => (qr.id === editingQR.id ? qrData : qr)))
    } else {
      setQrDatabase([...qrDatabase, qrData])
      setCurrentQR(qrData)
      setIsSuccessOpen(true)
    }
    setIsFormOpen(false)
  }

  const resetStockFormState = () => {
    setStockClass("")
    setStockGroup("")
    setStockProgram("")
    setStockQuantity("")
    setEditingStock(null)
  }

  const openAddStockDialog = () => {
    resetStockFormState()
    setIsStockDialogOpen(true)
  }

  const openEditStockDialog = (record: BookStockRecord) => {
    setEditingStock(record)
    setStockClass(record.classVal)
    setStockGroup(record.group ?? "")
    setStockProgram(record.program)
    setStockQuantity(String(record.availableStock))
    setIsStockDialogOpen(true)
  }

  const handleStockSubmit = () => {
    const quantityNumber = Number(stockQuantity)
    if (!stockClass || !stockProgram || Number.isNaN(quantityNumber) || quantityNumber < 0) {
      // Basic guard; in a real app we might show inline validation messages.
      return
    }

    if (editingStock) {
      setBookStock((prev) =>
        prev.map((record) =>
          record.id === editingStock.id
            ? {
                ...record,
                availableStock: quantityNumber,
              }
            : record,
        ),
      )
    } else {
      const newRecord: BookStockRecord = {
        id: `${stockClass}-${stockGroup || "na"}-${stockProgram}`.toLowerCase().replace(/\s+/g, "-"),
        classVal: stockClass,
        group: GROUP_CLASSES.has(stockClass) ? stockGroup || undefined : undefined,
        program: stockProgram,
        availableStock: quantityNumber,
      }
      setBookStock((prev) => [...prev, newRecord])
    }

    setIsStockDialogOpen(false)
    resetStockFormState()
  }

  // Reset stock pagination when filters change
  useEffect(() => {
    setStockPage(1)
  }, [stockFilterClass, stockFilterGroup, stockFilterProgram])

  const handleDownloadTemplate = () => {
    const csvContent = "user_id,academic_program_id,is_qr\n"
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "qr-access-template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleCsvFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCsvFileName(file.name)

    const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")

    if (!isCsv) {
      setCsvStatus("error")
      return
    }

    setCsvStatus("processing")

    // Simulate backend processing
    setTimeout(() => {
      setCsvStatus("success")
    }, 2000)
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }


  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="p-5 border-b">
          <h1 className="text-2xl font-bold text-purple-600">Shikho</h1>
        </div>
        <nav className="p-4">
          <div className="px-4 py-3 rounded-md bg-purple-50 text-purple-600 font-medium cursor-pointer">
            <span className="mr-3">📊</span>
            Dashboard
          </div>
          <div className="px-4 py-3 rounded-md font-medium cursor-pointer mt-1">
            <span className="mr-3">🔲</span>
            QR Management
          </div>
          <div className="ml-8 mt-1 space-y-1">
            <button
              onClick={() => setActiveMenu("generate")}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                activeMenu === "generate" ? "bg-purple-100 text-purple-700" : "hover:bg-muted"
              }`}
            >
              Map QR
            </button>
            <button
              onClick={() => setActiveMenu("quiz")}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                activeMenu === "quiz" ? "bg-purple-100 text-purple-700" : "hover:bg-muted"
              }`}
            >
              QR Quiz
            </button>
            <button
              onClick={() => setActiveMenu("stock")}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                activeMenu === "stock" ? "bg-purple-100 text-purple-700" : "hover:bg-muted"
              }`}
            >
              Stock Management
            </button>
            <button
              onClick={() => setActiveMenu("access")}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                activeMenu === "access" ? "bg-purple-100 text-purple-700" : "hover:bg-muted"
              }`}
            >
              Manage User Access
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="text-sm text-muted-foreground mb-4">
          DASHBOARD / <span className="font-semibold text-foreground">QR MANAGEMENT</span>
          <span className="text-muted-foreground">
            {" "}
            /{" "}
            {activeMenu === "generate"
              ? "Map QR"
              : activeMenu === "quiz"
                ? "QR Quiz"
                : activeMenu === "stock"
                  ? "Book Stock Management"
                  : "Manage User Access"}
          </span>
        </div>
        {activeMenu === "generate" ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>QR Codes Table</CardTitle>
              <div className="flex items-center gap-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or ID"
                  className="border rounded px-3 py-2 text-sm w-64"
                />
                <Button onClick={handleAddNew} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New QR
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>QR ID</TableHead>
                    <TableHead>Target Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qrDatabase.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No QR codes yet. Create one to get started!
                      </TableCell>
                    </TableRow>
                  ) : (
                    qrDatabase
                      .filter((qr) =>
                        `${qr.name} ${qr.id}`.toLowerCase().includes(search.toLowerCase())
                      )
                      .map((qr) => (
                      <TableRow key={qr.id}>
                        <TableCell className="font-medium">{qr.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{qr.id}</code>
                        </TableCell>
                        <TableCell className="text-sm">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-pointer">
                                  {qr.qrType === "quiz" ? (
                                    <span>QR Quiz</span>
                                  ) : qr.qrType === "shikho_ai" ? (
                                    <span>Shikho AI</span>
                                  ) : qr.qrType === "animated_video" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      <div>
                                        <div>
                                          {qr.mappings[0].subject}
                                          {qr.mappings[0].chapterName ? ` > ${(qr.mappings[0].chapterName || "").substring(0, 30)}` : ""}
                                        </div>
                                        {qr.mappings.length > 1 && (
                                          <div className="text-xs text-muted-foreground">+ {qr.mappings.length - 1} more mapping{qr.mappings.length - 1 > 1 ? "s" : ""}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span>Animated Video Lesson</span>
                                    )
                                  ) : qr.qrType === "lecture_class" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      <div>
                                        <div>
                                          {qr.mappings[0].program} &gt; {qr.mappings[0].subject} &gt; {(qr.mappings[0].chapterName || "").substring(0, 30)}
                                        </div>
                                        {qr.mappings.length > 1 && (
                                          <div className="text-xs text-muted-foreground">+ {qr.mappings.length - 1} more mapping{qr.mappings.length - 1 > 1 ? "s" : ""}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span>Lecture Class</span>
                                    )
                                  ) : qr.qrType === "live_exam" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      <div>
                                        <div>
                                          {qr.mappings[0].program} &gt; {qr.mappings[0].subject} &gt; {(qr.mappings[0].chapterName || "").substring(0, 30)}
                                        </div>
                                        {qr.mappings.length > 1 && (
                                          <div className="text-xs text-muted-foreground">+ {qr.mappings.length - 1} more mapping{qr.mappings.length - 1 > 1 ? "s" : ""}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span>Live Exam</span>
                                    )
                                  ) : Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                    <div>
                                      <div>
                                        {qr.mappings[0].program} &gt; {qr.mappings[0].subject} &gt; {(qr.mappings[0].chapterName || "").substring(0, 30)}
                                      </div>
                                      {qr.mappings.length > 1 && (
                                        <div className="text-xs text-muted-foreground">+ {qr.mappings.length - 1} more mapping{qr.mappings.length - 1 > 1 ? "s" : ""}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span>
                                      {qr.program} &gt; {qr.subject} &gt; {(qr.chapterName || "").substring(0, 30)}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <div className="space-y-1">
                                  {qr.qrType === "quiz" ? (
                                    <div>QR Quiz</div>
                                  ) : qr.qrType === "shikho_ai" ? (
                                    <div>Shikho AI</div>
                                  ) : qr.qrType === "animated_video" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      qr.mappings.map((m, idx) => (
                                        <div key={idx}>
                                          {m.classVal ? `${m.classVal.toUpperCase()} > ` : ""}
                                          {m.program ? `${m.program} > ` : ""}
                                          {m.subject}
                                          {m.chapterName ? ` > ${m.chapterName}` : " (Subject Level)"}
                                        </div>
                                      ))
                                    ) : (
                                      <div>Animated Video Lesson</div>
                                    )
                                  ) : qr.qrType === "lecture_class" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      qr.mappings.map((m, idx) => (
                                        <div key={idx}>
                                          {m.classVal ? `${m.classVal.toUpperCase()} > ` : ""}
                                          {m.program ? `${m.program} > ` : ""}
                                          {m.subject} > {m.chapterName || m.chapterId} > Lecture Class: {(qr as any).lectureClassId || m.lectureClassId || "N/A"}
                                        </div>
                                      ))
                                    ) : (
                                      <div>Lecture Class</div>
                                    )
                                  ) : qr.qrType === "live_exam" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      qr.mappings.map((m, idx) => (
                                        <div key={idx}>
                                          {m.classVal ? `${m.classVal.toUpperCase()} > ` : ""}
                                          {m.program ? `${m.program} > ` : ""}
                                          {m.subject} > {m.chapterName || m.chapterId} > Live Exam: {(qr as any).liveExamId || m.liveExamId || "N/A"}
                                        </div>
                                      ))
                                    ) : (
                                      <div>Live Exam</div>
                                    )
                                  ) : Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                    qr.mappings.map((m, idx) => (
                                      <div key={idx}>
                                        {m.classVal ? `${m.classVal.toUpperCase()} > ` : ""}
                                        {m.program ? `${m.program} > ` : ""}
                                        {m.subject} > {m.chapterName || m.chapterId || "Chapter"}
                                      </div>
                                    ))
                                  ) : (
                                    <div>
                                      {qr.program ? `${qr.program} > ` : ""}
                                      {qr.subject} > {qr.chapterName || qr.chapterId || "Chapter"}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          {qr.qrType === "quiz" || qr.qrType === "shikho_ai" || qr.qrType === "animated_video" ? (
                            <Badge className="bg-green-500">
                              <span className="mr-2">●</span>
                              Live
                            </Badge>
                          ) : Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                            (() => {
                              const allReady = qr.mappings?.every((m) => m.isContentReady)
                              return (
                                <Badge
                                  variant={allReady ? "default" : "secondary"}
                                  className={allReady ? "bg-green-500" : "bg-yellow-500"}
                                >
                                  <span className="mr-2">●</span>
                                  {allReady ? "Live" : "Fallback Active"}
                                </Badge>
                              )
                            })()
                          ) : (
                            <Badge
                              variant={qr.isContentReady ? "default" : "secondary"}
                              className={qr.isContentReady ? "bg-green-500" : "bg-yellow-500"}
                            >
                              <span className="mr-2">●</span>
                              {qr.isContentReady ? "Live" : "Fallback Active"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Pencil
                            className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-purple-600"
                            onClick={() => handleEdit(qr)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : activeMenu === "quiz" ? (
          <div className="mt-0">
            <QRQuizBuilder quizDatabase={quizDatabase} setQuizDatabase={setQuizDatabase} />
          </div>
        ) : activeMenu === "stock" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Filter by Class</Label>
                    <Select
                      value={stockFilterClass}
                      onValueChange={(value) => {
                        setStockFilterClass(value)
                        // Reset dependent filters when class changes
                        setStockFilterGroup("all")
                        setStockFilterProgram("all")
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {CLASS_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Filter by Group</Label>
                    <Select
                      value={stockFilterGroup}
                      onValueChange={setStockFilterGroup}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {GROUP_OPTIONS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Filter by Program</Label>
                    <Select
                      value={stockFilterProgram}
                      onValueChange={setStockFilterProgram}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {Array.from(new Set(bookStock.map((s) => s.program))).map((program) => (
                          <SelectItem key={program} value={program}>
                            {program}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Book Stock Inventory</CardTitle>
                <Button
                  onClick={openAddStockDialog}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stock
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Available Stock</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookStock.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No stock records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedBookStock.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.classVal}</TableCell>
                          <TableCell>{record.group || "-"}</TableCell>
                          <TableCell>{record.program}</TableCell>
                          <TableCell>{record.availableStock.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-purple-600"
                              onClick={() => openEditStockDialog(record)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                  <div>
                    Total{" "}
                    <span className="font-medium text-foreground">
                      {filteredBookStock.length}
                    </span>{" "}
                    item{filteredBookStock.length === 1 ? "" : "s"}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={stockPage <= 1 || filteredBookStock.length === 0}
                        onClick={() => setStockPage((prev) => Math.max(1, prev - 1))}
                      >
                        {"<"}
                      </Button>
                      {stockPageNumbers.map((page, idx) =>
                        page === "ellipsis" ? (
                          <span key={`ellipsis-${idx}`} className="px-1">
                            ...
                          </span>
                        ) : (
                          <Button
                            key={page}
                            variant={page === stockPage ? "default" : "outline"}
                            size="icon"
                            className={`h-7 w-7 text-xs ${
                              page === stockPage ? "bg-purple-600 text-white hover:bg-purple-700" : ""
                            }`}
                            onClick={() => setStockPage(page)}
                          >
                            {page}
                          </Button>
                        ),
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={
                          filteredBookStock.length === 0 ||
                          stockPage >= totalStockPages
                        }
                        onClick={() =>
                          setStockPage((prev) =>
                            Math.min(totalStockPages, prev + 1),
                          )
                        }
                      >
                        {">"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={String(stockPageSize)}
                        onValueChange={(value) => {
                          const size = Number(value) || 10
                          setStockPageSize(size)
                          setStockPage(1)
                        }}
                      >
                        <SelectTrigger className="h-7 w-[90px] px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 / page</SelectItem>
                          <SelectItem value="20">20 / page</SelectItem>
                          <SelectItem value="50">50 / page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Manage QR Access via CSV</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with <code>user_id</code>, <code>academic_program_id</code>, and{" "}
                  <code>is_qr</code> (<code>TRUE</code>/<code>FALSE</code>) columns to grant or revoke QR
                  scanner access. Granting access will check and decrement the book stock.
                </p>

                <Button variant="outline" onClick={handleDownloadTemplate}>
                  Download CSV Template
                </Button>

                <div
                  className="mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted transition-colors"
                  onClick={openFilePicker}
                >
                  <div className="text-3xl mb-2">☁️⬆️</div>
                  <p className="font-medium text-sm">
                    Click here to browse or drag &amp; drop a .csv file
                  </p>
                  {csvFileName && (
                    <p className="mt-1 text-xs text-muted-foreground">Selected file: {csvFileName}</p>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCsvFileChange}
                />

                {csvStatus !== "idle" && (
                  <div
                    className={`mt-4 rounded-md border px-4 py-3 text-sm ${
                      csvStatus === "error"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-green-500/40 bg-green-500/10 text-foreground"
                    }`}
                  >
                    {csvStatus === "processing" && (
                      <div>
                        <p className="font-semibold">Processing...</p>
                        {csvFileName && (
                          <p className="mt-1">
                            Simulating upload for file: <span className="font-mono">{csvFileName}</span>
                          </p>
                        )}
                      </div>
                    )}
                    {csvStatus === "success" && (
                      <div>
                        <h4 className="font-semibold mb-1">Upload Complete!</h4>
                        <p>
                          <strong>50</strong> users updated successfully.
                        </p>
                        <p className="mt-2">
                          <strong>3</strong> users failed:
                        </p>
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                          <li>
                            <code>user_id_abc</code>: No Stock Available for Program
                          </li>
                          <li>
                            <code>user_id_xyz</code>: Invalid User ID
                          </li>
                          <li>
                            <code>user_id_123</code>: No Stock Available for Program
                          </li>
                        </ul>
                      </div>
                    )}
                    {csvStatus === "error" && (
                      <div>
                        <p className="font-semibold">Error</p>
                        <p className="mt-1">Please upload a valid .csv file.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {activeMenu === "generate" && (
        <QRFormSheet
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={handleSubmit}
          editingQR={editingQR}
          quizDatabase={quizDatabase}
        />
      )}

      <QRSuccessDialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen} qrData={currentQR} />

      {/* Book Stock Add / Edit Dialog */}
      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStock ? "Update Existing Stock" : "Add New Stock Record"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Class <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={stockClass}
                  onValueChange={(value) => {
                    if (editingStock) return
                    setStockClass(value)
                    setStockGroup("")
                    setStockProgram("")
                  }}
                  disabled={!!editingStock}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASS_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {GROUP_CLASSES.has(stockClass) && (
                <div className="space-y-1.5">
                  <Label>
                    Group <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={stockGroup}
                    onValueChange={setStockGroup}
                    disabled={!!editingStock}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Program <span className="text-destructive">*</span>
              </Label>
              <Select
                value={stockProgram}
                onValueChange={setStockProgram}
                disabled={!stockClass || !!editingStock}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={stockClass ? "Select program" : "Select class first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableProgramsForSelectedClass.length === 0 ? (
                    <SelectItem value={stockProgram || "custom"} disabled>
                      No programs available for this class
                    </SelectItem>
                  ) : (
                    availableProgramsForSelectedClass.map((program) => (
                      <SelectItem key={program} value={program}>
                        {program}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                {editingStock ? "New Stock Quantity" : "Quantity"}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="e.g., 500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStockDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleStockSubmit}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
