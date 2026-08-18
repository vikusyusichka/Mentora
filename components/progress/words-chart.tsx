"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { LessonPoint } from "@/lib/progress";
import { browserTimeZone } from "@/lib/timezone";

/**
 * Нові слова за урок.
 *
 * Стовпчики, а не лінія: уроки це окремі події, а не безперервний ряд —
 * лінія між ними домальовувала б неіснуючі проміжні значення.
 *
 * Серія одна, тож легенда не потрібна — заголовок блоку її називає.
 * Розмовна практика показана **крапкою над стовпчиком**, а не другим
 * кольором: так ознака лишається читомою і в чорно-білому друку, і при
 * будь-якому типі дальтонізму.
 *
 * Колір `#1F7A50` — той самий sage-green бренду, підтягнутий по насиченості
 * так, щоб пройти перевірки контрасту й хроми на білій картці.
 */
const SERIES_COLOR = "#1F7A50";
const INK_MUTED = "#504632";
const GRID = "#EDE1D0";

interface Row extends LessonPoint {
  label: string;
}

export function WordsChart({ points }: { points: LessonPoint[] }) {
  const timeZone = browserTimeZone();
  const dayFormat = new Intl.DateTimeFormat("uk-UA", {
    timeZone,
    day: "numeric",
    month: "short",
  });

  const rows: Row[] = points.map((point) => ({
    ...point,
    label: dayFormat.format(new Date(point.slotStart)),
  }));

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid
              vertical={false}
              stroke={GRID}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: INK_MUTED, fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: INK_MUTED, fontSize: 12 }}
              width={44}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(69,16,16,0.04)" }}
              content={<PointTooltip />}
            />
            <Bar
              dataKey="newWords"
              fill={SERIES_COLOR}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              shape={<PracticeBar />}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-label-sm mt-3 flex items-center gap-2 text-outline">
        <svg width="10" height="10" aria-hidden>
          <circle cx="5" cy="5" r="4" fill={SERIES_COLOR} />
        </svg>
        крапка над стовпчиком — на уроці була розмовна практика
      </p>

      {/* Таблиця поруч із графіком: ті самі дані, доступні читачу екрана
          й тим, кому стовпчики читати незручно. */}
      <details className="mt-3">
        <summary className="text-label-md cursor-pointer text-muted-foreground">
          Показати таблицею
        </summary>
        <table className="text-label-md mt-3 w-full">
          <thead>
            <tr className="text-label-sm text-left uppercase tracking-[0.08em] text-outline">
              <th className="py-2 font-medium">Урок</th>
              <th className="py-2 font-medium">Нових слів</th>
              <th className="py-2 font-medium">Практика</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slotStart} className="border-t border-border">
                <td className="py-2 text-muted-foreground">{row.label}</td>
                <td className="py-2 text-secondary">{row.newWords}</td>
                <td className="py-2 text-muted-foreground">
                  {row.speakingPractice ? "була" : "не було"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/** Стовпчик із крапкою-позначкою розмовної практики. */
function PracticeBar(props: unknown) {
  const { x, y, width, height, payload } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    payload: Row;
  };

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={SERIES_COLOR} />
      {payload.speakingPractice && (
        <circle cx={x + width / 2} cy={y - 8} r={4} fill={SERIES_COLOR} />
      )}
    </g>
  );
}

function PointTooltip(props: unknown) {
  const { active, payload } = props as {
    active?: boolean;
    payload?: { payload: Row }[];
  };

  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-input border border-border bg-card px-3 py-2 shadow-level2">
      <p className="text-label-md text-secondary">{row.label}</p>
      <p className="text-label-sm text-muted-foreground">
        Нових слів: {row.newWords}
      </p>
      <p className="text-label-sm text-muted-foreground">
        Розмовна практика: {row.speakingPractice ? "була" : "не було"}
      </p>
    </div>
  );
}
