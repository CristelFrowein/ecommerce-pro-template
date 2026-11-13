import { formatReportTimestamp } from "./orderReport.js"

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
const CHART = "http://schemas.openxmlformats.org/drawingml/2006/chart"
const DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
const MAIN = "http://schemas.openxmlformats.org/drawingml/2006/main"

const escapeXml = value => String(value).replace(/[<>&"']/g, char =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]
)

const relationship = (type, target) =>
  `${XML}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${REL}/${type}" Target="${target}"/></Relationships>`

function seriesXml(state, index, buckets, first, column) {
  const last = first + buckets.length - 1
  const labels = buckets.map((bucket, i) =>
    `<c:pt idx="${i}"><c:v>${escapeXml(bucket.label)}</c:v></c:pt>`
  ).join("")
  const values = buckets.map((bucket, i) =>
    `<c:pt idx="${i}"><c:v>${bucket.counts[state.key]}</c:v></c:pt>`
  ).join("")

  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>
<c:tx><c:strRef><c:f>Resumen!${column}${first - 1}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${state.label}</c:v></c:pt></c:strCache></c:strRef></c:tx>
<c:spPr><a:solidFill><a:srgbClr val="${state.color.slice(1)}"/></a:solidFill></c:spPr>
<c:cat><c:strRef><c:f>Resumen!$A$${first}:$A$${last}</c:f><c:strCache><c:ptCount val="${buckets.length}"/>${labels}</c:strCache></c:strRef></c:cat>
<c:val><c:numRef><c:f>Resumen!${column}${first}:${column}${last}</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="${buckets.length}"/>${values}</c:numCache></c:numRef></c:val></c:ser>`
}

function styleWorksheet(xml, look, styleFor) {
  return xml
    .replace(/<sheetView(?=[\s>])/, '<sheetView showGridLines="0"')
    .replace(/<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g, (_, number, attributes, content) => {
      const row = Number(number)
      const title = row === 1 && look.title
      const header = row === look.header || (look.title && (row === 6 || row === look.header - 1))
      const height = title ? 32 : header ? 24 : 20

      const cells = content.replace(/<c r="([A-Z]+)\d+"([^>]*?)(\/?)>/g, (_, column, attrs, close) => {
        const oldStyle = / s="(\d+)"/.exec(attrs)
        const clean = attrs.replace(/ s="\d+"/, "")
        const tone = title
          ? "title"
          : header
            ? "header"
            : look.states?.[column] && row > look.header
              ? look.states[column]
              : row % 2 === 0 ? "band" : "body"
        const style = styleFor(tone, Number(oldStyle?.[1] || 0))
        return `<c r="${column}${number}"${clean} s="${style}"${close}>`
      })

      return `<row r="${number}"${attributes} ht="${height}" customHeight="1">${cells}</row>`
    })
}

function styleWorkbook(styles, styleSheets) {
  const fonts = [
    ["25352B", 11, false],
    ["FFFFFF", 18, true],
    ["FFFFFF", 11, true]
  ].map(([color, size, bold]) =>
    `<font>${bold ? "<b/>" : ""}<sz val="${size}"/><color rgb="FF${color}"/><name val="Calibri"/><family val="2"/></font>`
  )

  const colors = {
    title: "30483B",
    header: "476053",
    band: "F1F5F0",
    completed: "E6F3E9",
    pending: "FAEEDB",
    cancelled: "F8E9E7"
  }

  const fills = Object.values(colors).map(color =>
    `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`
  )

  const withParts = (xml, tag, parts) => xml.replace(
    new RegExp(`<${tag} count="(\\d+)">([\\s\\S]*?)</${tag}>`),
    (_, count, content) => `<${tag} count="${Number(count) + parts.length}">${content}${parts.join("")}</${tag}>`
  )

  const fontStart = Number(/<fonts count="(\d+)"/.exec(styles)[1])
  const fillStart = Number(/<fills count="(\d+)"/.exec(styles)[1])
  const formats = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(styles)
  const baseStyles = [...formats[2].matchAll(/<xf\b[^>]*numFmtId="(\d+)"/g)]
  const custom = []
  const cache = new Map()

  styleSheets((tone, original) => {
    const key = `${tone}:${original}`
    if (!cache.has(key)) {
      const font = fontStart + (tone === "title" ? 1 : tone === "header" ? 2 : 0)
      const fill = tone === "body" ? 0 : fillStart + Object.keys(colors).indexOf(tone)
      const numberFormat = baseStyles[original]?.[1] || 0

      cache.set(key, Number(formats[1]) + custom.length)
      custom.push(
        `<xf numFmtId="${numberFormat}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>`
      )
    }
    return cache.get(key)
  })

  return withParts(withParts(withParts(styles, "fonts", fonts), "fills", fills), "cellXfs", custom)
}

function formatReportFile(xlsx, workbook, report, first) {
  const archive = xlsx.CFB.read(
    new Uint8Array(xlsx.write(workbook, { type: "array" })),
    { type: "array" }
  )
  const encode = new TextEncoder()
  const decode = new TextDecoder()
  const add = (path, xml) => xlsx.CFB.utils.cfb_add(archive, path, encode.encode(xml))

  // Actualiza cada parte existente en su lugar para mantener una sola entrada por ruta.
  const replace = (path, transform) => {
    const entry = xlsx.CFB.find(archive, `/${path}`)
    const content = encode.encode(transform(decode.decode(entry.content)))
    entry.content = content
    entry.size = content.length
  }

  const stateColumns = Object.fromEntries(report.states.map((state, index) =>
    [xlsx.utils.encode_col(index + 1), state.key]
  ))
  const sheets = [
    { title: true, header: first - 1, states: stateColumns },
    { header: 1 },
    { header: 1 }
  ]

  replace("xl/styles.xml", styles => styleWorkbook(styles, styleFor => {
    sheets.forEach((look, index) => replace(`xl/worksheets/sheet${index + 1}.xml`, xml =>
      styleWorksheet(xml, look, styleFor)
    ))
  }))

  replace("xl/worksheets/sheet1.xml", xml =>
    xml.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>')
  )
  replace("[Content_Types].xml", xml => xml.replace("</Types>",
    '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' +
    '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>'
  ))

  add("xl/worksheets/_rels/sheet1.xml.rels", relationship("drawing", "../drawings/drawing1.xml"))
  add("xl/drawings/_rels/drawing1.xml.rels", relationship("chart", "../charts/chart1.xml"))
  add("xl/drawings/drawing1.xml", `${XML}
<xdr:wsDr xmlns:xdr="${DRAWING}" xmlns:c="${CHART}" xmlns:r="${REL}">
<xdr:twoCellAnchor><xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>15</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>19</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Pedidos por estado"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off xmlns:a="${MAIN}" x="0" y="0"/><a:ext xmlns:a="${MAIN}" cx="0" cy="0"/></xdr:xfrm>
<a:graphic xmlns:a="${MAIN}"><a:graphicData uri="${CHART}"><c:chart r:id="rId1"/></a:graphicData></a:graphic>
</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`)

  const series = report.states.map((state, index) =>
    seriesXml(state, index, report.buckets, first, `$${xlsx.utils.encode_col(index + 1)}$`)
  ).join("")

  add("xl/charts/chart1.xml", `${XML}
<c:chartSpace xmlns:c="${CHART}" xmlns:a="${MAIN}"><c:lang val="es-AR"/><c:chart>
<c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="stacked"/>
<c:varyColors val="0"/>${series}<c:gapWidth val="70"/><c:overlap val="100"/><c:axId val="100"/><c:axId val="200"/>
</c:barChart>
<c:catAx><c:axId val="100"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="200"/><c:crosses val="autoZero"/><c:auto val="1"/></c:catAx>
<c:valAx><c:axId val="200"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="100"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>
</c:plotArea><c:legend><c:legendPos val="b"/><c:layout/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="zero"/></c:chart></c:chartSpace>`)

  return xlsx.CFB.write(archive, { fileType: "zip", type: "array", compression: true })
}

const excelClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
})

function excelDate(date) {
  if (!date) return null

  const { year, month, day, hour, minute, second } = Object.fromEntries(
    excelClock.formatToParts(date).map(({ type, value }) => [type, Number(value)])
  )
  return Date.UTC(year, month - 1, day, hour, minute, second) / 86400000 + 25569
}

export function createReportWorkbook(xlsx, report) {
  const workbook = xlsx.utils.book_new()
  const amounts = [
    ["Importe de pedidos completados", report.completed],
    ["Mercado Pago aprobado y verificado", report.approved],
    ["Mercado Pago aprobado en prueba", report.approvedTest]
  ]

  const summary = [
    ["REPORTE DE PEDIDOS"],
    ["Período analizado", report.period.name + " · " + report.period.label],
    ["Datos consultados (Argentina)", formatReportTimestamp(report.now)],
    ["Criterio", "Fecha de creación y estado al exportar"],
    [],
    ["Indicador", "Valor", "Moneda"],
    ["Pedidos incluidos", report.rows.length],
    ["Sin fecha válida (fuera del balance)", report.undated],
    ...report.states.map(state => [state.label, report.counts[state.key]]),
    ...amounts.flatMap(([label, totals]) =>
      [...totals].map(([currency, total]) => [label, total, currency])
    ),
    [],
    ["Pedidos por período"],
    ["Tramo", ...report.states.map(state => state.label)]
  ]

  const first = summary.length + 1
  summary.push(...report.buckets.map(bucket => [
    bucket.label,
    ...report.states.map(state => bucket.counts[state.key])
  ]))

  const stateLabel = Object.fromEntries(report.states.map(state => [state.key, state.label]))
  const sheets = [
    ["Resumen", summary, [42, 25, 17, 17, 4]],
    ["Detalle", [
      [
        "Pedido", "Fecha de creación (AR)", "Fecha completado (AR)",
        "Fecha cancelado (AR)", "Estado", "Medio", "Estado del pago", "Importe", "Moneda"
      ],
      ...report.rows.map(row => [
        row.id, excelDate(row.created), excelDate(row.completedAt), excelDate(row.cancelledAt),
        stateLabel[row.state], row.payment.method, row.payment.label, row.total, row.currency
      ])
    ], [34, 24, 24, 24, 17, 24, 24, 16, 10]],
    ["Más vendidos", [
      ["Puesto", "Producto", "ID de producto", "Unidades", "Pedidos completados"],
      ...report.ranking.map((entry, index) => [
        index + 1, entry.name, entry.id, entry.units, entry.orders
      ])
    ], [10, 42, 30, 13, 24]]
  ]

  for (const [name, rows, widths] of sheets) {
    const sheet = xlsx.utils.aoa_to_sheet(rows)
    sheet["!cols"] = widths.map(wch => ({ wch }))

    if (name === "Resumen") {
      sheet["!merges"] = [1, 2, 3, 4, first - 2].map(row =>
        xlsx.utils.decode_range(`${row === 1 || row === first - 2 ? "A" : "B"}${row}:D${row}`)
      )
      amounts.forEach(([label]) => {
        summary.forEach(([name, value], index) => {
          if (name === label && typeof value === "number") {
            sheet[`B${index + 1}`].z = "#,##0.00"
          }
        })
      })
    } else {
      sheet["!autofilter"] = { ref: sheet["!ref"] }
    }

    if (name === "Detalle") {
      for (let row = 2; row <= rows.length; row += 1) {
        for (const column of ["B", "C", "D"]) {
          const cell = sheet[`${column}${row}`]
          if (cell) cell.z = "dd/mm/yyyy hh:mm:ss"
        }
        if (sheet[`H${row}`]) sheet[`H${row}`].z = "#,##0.00"
      }
    }

    xlsx.utils.book_append_sheet(workbook, sheet, name)
  }

  return formatReportFile(xlsx, workbook, report, first)
}

export async function downloadOrderReport(report, unit) {
  const xlsx = await import("xlsx")
  const bytes = createReportWorkbook(xlsx, report)
  const blob = new Blob([Uint8Array.from(bytes)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  const periodName = { week: "semanal", month: "mensual", year: "anual" }[unit]

  link.href = url
  link.download = `pedidos-${periodName}-${report.period.start}.xlsx`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}