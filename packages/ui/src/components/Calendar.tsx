import type { ReactNode } from 'react';

// 표현 전용 달력 — 로직(예약 윈도우/그리드 계산)은 호출 측이 주입합니다.
// @hosthelper/ui 의 독립성 유지를 위해 도메인 의존성을 두지 않습니다.
export interface CalendarCell {
  key: string; // 고유 키(보통 ISO 날짜)
  day: number; // 표시할 일(1~31)
  inMonth: boolean; // 현재 달 소속
  isToday: boolean;
  selectable: boolean;
  selected: boolean;
}

export interface CalendarProps {
  monthLabel: string;
  weekdayLabels: readonly string[];
  cells: CalendarCell[];
  onSelect: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  footnote?: ReactNode;
}

export function Calendar({
  monthLabel,
  weekdayLabels,
  cells,
  onSelect,
  onPrev,
  onNext,
  canPrev,
  canNext,
  footnote,
}: CalendarProps) {
  return (
    <div className="hh-cal">
      <div className="hh-cal__head">
        <button
          type="button"
          className="hh-cal__nav"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="이전 달"
        >
          ‹
        </button>
        <div className="hh-cal__title" aria-live="polite">
          {monthLabel}
        </div>
        <button
          type="button"
          className="hh-cal__nav"
          onClick={onNext}
          disabled={!canNext}
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="hh-cal__grid hh-cal__weekdays" aria-hidden="true">
        {weekdayLabels.map((w) => (
          <div key={w} className="hh-cal__wd">
            {w}
          </div>
        ))}
      </div>

      <div className="hh-cal__grid">
        {cells.map((c) => {
          const classes = [
            'hh-cal__cell',
            c.inMonth ? '' : 'hh-cal__cell--out',
            c.isToday ? 'hh-cal__cell--today' : '',
            c.selected ? 'hh-cal__cell--selected' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={c.key}
              type="button"
              className={classes}
              disabled={!c.selectable}
              aria-pressed={c.selected}
              onClick={() => onSelect(c.key)}
            >
              {c.day}
            </button>
          );
        })}
      </div>

      {footnote ? <div className="hh-cal__footnote">{footnote}</div> : null}
    </div>
  );
}
