"""Generate a high-resolution QR PNG for the public Forge entry page."""
from pathlib import Path
from PIL import Image, ImageDraw

URL = "https://forge-e1f5b.web.app/"
VERSION = 3
SIZE = 17 + 4 * VERSION
DATA_CODEWORDS = 55       # QR version 3, error correction level L
ECC_CODEWORDS = 15


def append_bits(out, value, count):
    out.extend((value >> i) & 1 for i in range(count - 1, -1, -1))


def gf_mul(x, y):
    result = 0
    for _ in range(8):
        if y & 1:
            result ^= x
        y >>= 1
        x <<= 1
        if x & 0x100:
            x ^= 0x11D
    return result


def rs_divisor(degree):
    result = [0] * degree
    result[-1] = 1
    root = 1
    for _ in range(degree):
        for j in range(degree):
            result[j] = gf_mul(result[j], root)
            if j + 1 < degree:
                result[j] ^= result[j + 1]
        root = gf_mul(root, 2)
    return result


def rs_remainder(data, divisor):
    result = [0] * len(divisor)
    for value in data:
        factor = value ^ result[0]
        result = result[1:] + [0]
        for i, coefficient in enumerate(divisor):
            result[i] ^= gf_mul(coefficient, factor)
    return result


payload = URL.encode("ascii")
bits = []
append_bits(bits, 0b0100, 4)  # byte mode
append_bits(bits, len(payload), 8)
for value in payload:
    append_bits(bits, value, 8)
capacity = DATA_CODEWORDS * 8
bits.extend([0] * min(4, capacity - len(bits)))
while len(bits) % 8:
    bits.append(0)
data = [sum(bits[i + j] << (7 - j) for j in range(8)) for i in range(0, len(bits), 8)]
for i in range(DATA_CODEWORDS - len(data)):
    data.append((0xEC, 0x11)[i % 2])
codewords = data + rs_remainder(data, rs_divisor(ECC_CODEWORDS))
stream = [(word >> bit) & 1 for word in codewords for bit in range(7, -1, -1)]

matrix = [[None] * SIZE for _ in range(SIZE)]


def place_finder(cx, cy):
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            x, y = cx + dx, cy + dy
            if 0 <= x < SIZE and 0 <= y < SIZE:
                distance = max(abs(dx), abs(dy))
                matrix[y][x] = distance not in (2, 4)


place_finder(3, 3)
place_finder(SIZE - 4, 3)
place_finder(3, SIZE - 4)

for i in range(8, SIZE - 8):
    matrix[6][i] = i % 2 == 0
    matrix[i][6] = i % 2 == 0

for cy in (6, 22):
    for cx in (6, 22):
        if matrix[cy][cx] is None:
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    matrix[cy + dy][cx + dx] = max(abs(dx), abs(dy)) != 1

matrix[4 * VERSION + 9][8] = True  # fixed dark module

# Format information for error correction L and mask pattern 0.
format_data = 0b01 << 3
remainder = format_data
for _ in range(10):
    remainder = (remainder << 1) ^ (0x537 if (remainder >> 9) & 1 else 0)
format_bits = ((format_data << 10) | remainder) ^ 0x5412
for i in range(15):
    bit = ((format_bits >> i) & 1) != 0
    if i < 6:
        matrix[i][8] = bit
    elif i < 8:
        matrix[i + 1][8] = bit
    elif i == 8:
        matrix[8][7] = bit
    else:
        matrix[8][14 - i] = bit
    if i < 8:
        matrix[8][SIZE - 1 - i] = bit
    else:
        matrix[SIZE - 15 + i][8] = bit

index = 0
right = SIZE - 1
upward = True
while right >= 1:
    if right == 6:
        right -= 1
    for vertical in range(SIZE):
        y = SIZE - 1 - vertical if upward else vertical
        for x in (right, right - 1):
            if matrix[y][x] is None:
                data_bit = stream[index] if index < len(stream) else 0
                index += 1
                matrix[y][x] = bool(data_bit ^ (((x + y) % 2) == 0))
    upward = not upward
    right -= 2

if index < len(stream):
    raise RuntimeError(f"QR trop petit : {index}/{len(stream)} bits placés")

scale = 24
quiet_zone = 4
side = (SIZE + quiet_zone * 2) * scale
image = Image.new("RGB", (side, side), "white")
draw = ImageDraw.Draw(image)
for y, row in enumerate(matrix):
    for x, dark in enumerate(row):
        if dark:
            x0, y0 = (x + quiet_zone) * scale, (y + quiet_zone) * scale
            draw.rectangle((x0, y0, x0 + scale - 1, y0 + scale - 1), fill="#111211")

output = Path(__file__).with_name("forge-qr.png")
image.save(output)
print(f"QR Forge : {URL}")
print(f"Image : {output} ({side} x {side} px)")
