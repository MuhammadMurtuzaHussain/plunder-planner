/** Things a visitor can take away: a share image and a calendar reminder. Both are made in the browser. */

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const loadImage = (src: string) => new Promise<HTMLImageElement | null>(resolve => {
  const img = new Image();
  img.crossOrigin = 'anonymous';           // the image host allows this, so the canvas stays exportable
  img.onload = () => resolve(img); img.onerror = () => resolve(null);
  img.src = src;
});

export interface ShareCard { dates: string; headline: string; detail: string; images: string[]; site: string }

/** 1200x675 image summarising the plan. Contains dates and item art only, never the locker. */
export async function saveShareCard(card: ShareCard) {
  await document.fonts.ready;
  const W = 1200, H = 675, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createRadialGradient(W, 0, 0, W, 0, 1100);
  bg.addColorStop(0, '#254450'); bg.addColorStop(0.6, '#101b21'); bg.addColorStop(1, '#0b1216');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // dashed route and the X that marks the spot
  g.strokeStyle = 'rgba(232,220,192,0.55)'; g.lineWidth = 3; g.setLineDash([3, 14]); g.lineCap = 'round';
  g.beginPath(); g.moveTo(640, 90); g.bezierCurveTo(820, 40, 900, 210, 1040, 150); g.stroke();
  g.setLineDash([]); g.strokeStyle = '#f4c531'; g.lineWidth = 9;
  g.beginPath(); g.moveTo(1050, 128); g.lineTo(1094, 172); g.moveTo(1094, 128); g.lineTo(1050, 172); g.stroke();

  const display = "800 %px 'Bricolage Grotesque Variable', sans-serif", body = "500 %px 'Geist Variable', sans-serif";
  g.textBaseline = 'alphabetic';
  g.font = display.replace('%', '34'); g.fillStyle = '#f1ead9'; g.fillText('PLUNDER', 64, 96);
  g.fillStyle = '#f4c531'; g.fillText('PLANNER', 64 + g.measureText('PLUNDER ').width, 96);
  g.font = body.replace('%', '28'); g.fillStyle = '#e8dcc0'; g.fillText(card.headline, 64, 250);
  let size = 104; g.font = display.replace('%', String(size));
  while (g.measureText(card.dates).width > W - 128 && size > 56) { size -= 4; g.font = display.replace('%', String(size)); }
  g.fillStyle = '#f1ead9'; g.fillText(card.dates, 60, 250 + size);
  g.font = body.replace('%', '28'); g.fillStyle = '#f4c531'; g.fillText(card.detail, 64, 250 + size + 54);

  const imgs = await Promise.all(card.images.slice(0, 6).map(loadImage));
  const S = 116, y = H - 64 - S;
  imgs.forEach((img, k) => {
    const x = 64 + k * (S + 14);
    g.fillStyle = '#16242c'; g.beginPath(); g.roundRect(x, y, S, S, 14); g.fill();
    if (img) { g.save(); g.beginPath(); g.roundRect(x, y, S, S, 14); g.clip(); g.drawImage(img, x, y, S, S); g.restore(); }
  });
  g.font = "500 22px 'Geist Mono Variable', monospace"; g.fillStyle = '#93a3a8'; g.textAlign = 'right';
  g.fillText(card.site, W - 64, H - 70);

  const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'));
  if (blob) download(blob, 'my-plunder-plan.png');
  return !!blob;
}

/** All-day calendar event on the day to claim. */
export function saveReminder(date: Date, title: string, description: string) {
  const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const next = new Date(date.getTime() + 86400000);
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Plunder Planner//EN', 'BEGIN:VEVENT',
    `UID:${ymd(date)}-plunder-planner`, `DTSTAMP:${ymd(new Date())}T000000Z`, `DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(description)}`, 'BEGIN:VALARM', 'TRIGGER:-PT12H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  download(new Blob([ics], { type: 'text/calendar' }), 'claim-pirate-shop-access.ics');
}
