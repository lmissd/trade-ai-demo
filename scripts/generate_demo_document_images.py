from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "pics"
PAGE_SIZE = (1654, 2339)
MARGIN_X = 120
MARGIN_Y = 110


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates.extend(
            [
                r"C:\Windows\Fonts\msyhbd.ttc",
                r"C:\Windows\Fonts\simhei.ttf",
                r"C:\Windows\Fonts\arialbd.ttf",
            ]
        )
    candidates.extend(
        [
            r"C:\Windows\Fonts\msyh.ttc",
            r"C:\Windows\Fonts\simsun.ttc",
            r"C:\Windows\Fonts\arial.ttf",
        ]
    )

    for font_path in candidates:
        path = Path(font_path)
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                continue

    return ImageFont.load_default()


FONT_TITLE = load_font(42, bold=True)
FONT_SUBTITLE = load_font(24, bold=True)
FONT_TEXT = load_font(24)
FONT_SMALL = load_font(20)
FONT_CAPTION = load_font(18)


def create_page(doc_title: str, doc_code: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", PAGE_SIZE, "#fbf8f1")
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((72, 72, PAGE_SIZE[0] - 72, PAGE_SIZE[1] - 72), radius=36, outline="#d6d0c5", width=3)
    draw.text((MARGIN_X, MARGIN_Y), "国际贸易 ERP 演示单据", font=FONT_SUBTITLE, fill="#5d4f3f")
    draw.text((MARGIN_X, MARGIN_Y + 48), doc_title, font=FONT_TITLE, fill="#1f1f1f")
    draw.text((PAGE_SIZE[0] - 500, MARGIN_Y + 10), f"单据编号：{doc_code}", font=FONT_TEXT, fill="#4c4c4c")
    draw.line((MARGIN_X, MARGIN_Y + 120, PAGE_SIZE[0] - MARGIN_X, MARGIN_Y + 120), fill="#d7d1c7", width=2)

    return image, draw


def draw_kv_grid(
    draw: ImageDraw.ImageDraw,
    top: int,
    rows: list[tuple[str, str, str, str]],
    row_height: int = 66,
) -> int:
    left = MARGIN_X
    right = PAGE_SIZE[0] - MARGIN_X
    width = right - left
    mid = left + width // 2
    bottom = top + row_height * len(rows)

    draw.rectangle((left, top, right, bottom), outline="#bbb3a8", width=2)
    draw.line((mid, top, mid, bottom), fill="#cfc8be", width=2)

    for index, row in enumerate(rows):
        row_top = top + row_height * index
        if index > 0:
            draw.line((left, row_top, right, row_top), fill="#d9d2c7", width=2)

        label_a, value_a, label_b, value_b = row
        draw.text((left + 24, row_top + 18), label_a, font=FONT_SMALL, fill="#6a6258")
        draw.text((left + 180, row_top + 18), value_a, font=FONT_SMALL, fill="#1f1f1f")
        draw.text((mid + 24, row_top + 18), label_b, font=FONT_SMALL, fill="#6a6258")
        draw.text((mid + 180, row_top + 18), value_b, font=FONT_SMALL, fill="#1f1f1f")

    return bottom


def draw_table(
    draw: ImageDraw.ImageDraw,
    top: int,
    headers: list[str],
    rows: list[list[str]],
    col_widths: list[int],
    row_height: int = 62,
) -> int:
    left = MARGIN_X
    right = left + sum(col_widths)
    bottom = top + row_height * (len(rows) + 1)

    draw.rectangle((left, top, right, bottom), outline="#b8b0a4", width=2)

    x = left
    for width in col_widths[:-1]:
        x += width
        draw.line((x, top, x, bottom), fill="#d1c9bd", width=2)

    for row_index in range(1, len(rows) + 1):
        y = top + row_height * row_index
        draw.line((left, y, right, y), fill="#d9d2c7", width=2)

    x = left
    for header, width in zip(headers, col_widths):
        draw.text((x + 16, top + 18), header, font=FONT_SMALL, fill="#5f5549")
        x += width

    for row_index, row in enumerate(rows, start=1):
        x = left
        row_top = top + row_height * row_index
        for value, width in zip(row, col_widths):
            draw.text((x + 16, row_top + 18), value, font=FONT_SMALL, fill="#1f1f1f")
            x += width

    return bottom


def draw_paragraph(draw: ImageDraw.ImageDraw, top: int, lines: list[str], line_height: int = 40) -> int:
    current_top = top
    for line in lines:
        draw.text((MARGIN_X, current_top), line, font=FONT_TEXT, fill="#242424")
        current_top += line_height
    return current_top


def draw_footer(draw: ImageDraw.ImageDraw, top: int, left_sign: str, right_sign: str) -> None:
    left = MARGIN_X
    right = PAGE_SIZE[0] - MARGIN_X
    mid = (left + right) // 2

    draw.line((left + 80, top, mid - 60, top), fill="#8a8176", width=2)
    draw.line((mid + 60, top, right - 80, top), fill="#8a8176", width=2)
    draw.text((left + 140, top + 16), left_sign, font=FONT_SMALL, fill="#4b433a")
    draw.text((mid + 120, top + 16), right_sign, font=FONT_SMALL, fill="#4b433a")
    draw.text((MARGIN_X, top + 70), "备注：本图片由演示系统自动生成，用于手动上传与 AI Mock 识别演示。", font=FONT_CAPTION, fill="#7a7268")


def generate_contract() -> Path:
    image, draw = create_page("采购合同 / Purchase Contract", "CTR-DEMO-202606-001")

    top = MARGIN_Y + 150
    top = draw_kv_grid(
        draw,
        top,
        [
            ("合同号", "CTR-DEMO-202606-001", "签订日期", "2026-06-08"),
            ("买方", "赞比亚客户 ABC Trading", "卖方", "中国供应商 China Supplier Co., Ltd."),
            ("目的仓库", "赞比亚仓库", "币种", "USD"),
            ("总数量", "100 箱", "合同金额", "50,000.00"),
        ],
    )

    top += 48
    draw.text((MARGIN_X, top), "货物明细", font=FONT_SUBTITLE, fill="#222222")
    top += 48
    top = draw_table(
        draw,
        top,
        ["序号", "商品名称", "规格", "数量", "单位", "单价(USD)", "金额(USD)"],
        [["1", "铜缆演示货物", "Copper Cable / Demo SKU", "100", "箱", "500", "50,000"]],
        [120, 340, 330, 160, 120, 220, 244],
    )

    top += 54
    top = draw_paragraph(
        draw,
        top,
        [
            "1. 本合同项下货物由中国境内采购后发往赞比亚仓库。",
            "2. 卖方应提供合同、箱单、发票、提单等完整单据，用于国际贸易 ERP 演示链路。",
            "3. 本批货物默认演示数量为 100 箱，后续可通过系统配置调整。",
            "4. 库存数量以二维码真实状态和扫码流水为准，不直接等同于合同数量。",
        ],
    )

    draw_footer(draw, PAGE_SIZE[1] - 280, "卖方签章 / Seller", "买方签章 / Buyer")

    output_path = OUTPUT_DIR / "演示合同-中国采购100箱.png"
    image.save(output_path)
    return output_path


def generate_packing_list() -> Path:
    image, draw = create_page("装箱单 / Packing List", "PKL-DEMO-202606-001")

    top = MARGIN_Y + 150
    top = draw_kv_grid(
        draw,
        top,
        [
            ("关联合同", "CTR-DEMO-202606-001", "关联批次", "BAT-DEMO-202606-001"),
            ("发货方", "China Supplier Co., Ltd.", "收货方", "ABC Trading Zambia"),
            ("起运地", "中国深圳", "目的仓库", "赞比亚仓库"),
            ("总箱数", "100 箱", "总毛重", "8,500 KG"),
        ],
    )

    top += 48
    draw.text((MARGIN_X, top), "箱单明细", font=FONT_SUBTITLE, fill="#222222")
    top += 48
    top = draw_table(
        draw,
        top,
        ["箱号范围", "商品名称", "SKU", "数量", "单位", "建议库位", "备注"],
        [["001-100", "铜缆演示货物", "SKU-DEMO-CABLE-001", "100", "箱", "A-01-01", "标准演示箱单"]],
        [210, 320, 270, 120, 120, 180, 194],
    )

    top += 54
    top = draw_paragraph(
        draw,
        top,
        [
            "Marks & Numbers: CONT-DEMO-202606-001",
            "Package Type: Carton Box",
            "Demo Note: 该箱单用于演示“上传箱单 -> AI 识别 -> 生成人工确认批次 -> 二维码追溯”。",
        ],
    )

    draw_footer(draw, PAGE_SIZE[1] - 280, "仓储复核 / Warehouse Check", "制单人 / Prepared By")

    output_path = OUTPUT_DIR / "演示箱单-赞比亚仓库100箱.png"
    image.save(output_path)
    return output_path


def generate_invoice() -> Path:
    image, draw = create_page("商业发票 / Commercial Invoice", "INV-DEMO-202606-001")

    top = MARGIN_Y + 150
    top = draw_kv_grid(
        draw,
        top,
        [
            ("发票号", "INV-DEMO-202606-001", "发票日期", "2026-06-08"),
            ("开票方", "China Supplier Co., Ltd.", "收票方", "ABC Trading Zambia"),
            ("付款币种", "USD", "贸易术语", "CIF"),
            ("关联合同", "CTR-DEMO-202606-001", "关联系统批次", "BAT-DEMO-202606-001"),
        ],
    )

    top += 48
    draw.text((MARGIN_X, top), "费用明细", font=FONT_SUBTITLE, fill="#222222")
    top += 48
    top = draw_table(
        draw,
        top,
        ["项目", "商品名称", "数量", "单位", "单价(USD)", "金额(USD)"],
        [["1", "铜缆演示货物", "100", "箱", "500", "50,000"]],
        [140, 520, 180, 120, 250, 324],
    )

    top += 54
    top = draw_paragraph(
        draw,
        top,
        [
            "Total Amount: USD 50,000.00",
            "Bank Advice: Demo only, first version keeps receivable data as controllable business draft.",
            "AI Note: 发票数量与箱单数量保持一致，可用于清关一致性校验演示。",
        ],
    )

    draw_footer(draw, PAGE_SIZE[1] - 280, "财务审核 / Finance Review", "开票签章 / Issuer")

    output_path = OUTPUT_DIR / "演示发票-50000USD.png"
    image.save(output_path)
    return output_path


def generate_bill_of_lading() -> Path:
    image, draw = create_page("提单 / Bill of Lading", "BL-DEMO-202606-001")

    top = MARGIN_Y + 150
    top = draw_kv_grid(
        draw,
        top,
        [
            ("提单号", "BL-DEMO-202606-001", "柜号", "CONT-DEMO-202606-001"),
            ("船公司", "Demo Ocean Line", "船名航次", "MV ERP STAR / V.202606"),
            ("起运港", "Shenzhen Port", "目的港", "Dar es Salaam Port"),
            ("收货人", "ABC Trading Zambia", "通知人", "ABC Trading Zambia"),
        ],
    )

    top += 48
    draw.text((MARGIN_X, top), "运输信息", font=FONT_SUBTITLE, fill="#222222")
    top += 48
    top = draw_table(
        draw,
        top,
        ["唛头", "货描", "件数", "包装", "毛重", "体积", "备注"],
        [["DEMO-CABLE", "铜缆演示货物 / Copper Cable", "100", "Carton", "8,500 KG", "26 CBM", "待清关"]],
        [180, 430, 120, 160, 170, 160, 242],
    )

    top += 54
    top = draw_paragraph(
        draw,
        top,
        [
            "Loading Date: 2026-06-09",
            "ETA: 2026-06-23",
            "Demo Note: 到港后系统将联动清关工单与仓库预收货任务。",
        ],
    )

    draw_footer(draw, PAGE_SIZE[1] - 280, "承运人签章 / Carrier", "制单代理 / Agent")

    output_path = OUTPUT_DIR / "演示提单-CONT-DEMO-202606-001.png"
    image.save(output_path)
    return output_path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = [
        generate_contract(),
        generate_packing_list(),
        generate_invoice(),
        generate_bill_of_lading(),
    ]
    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
