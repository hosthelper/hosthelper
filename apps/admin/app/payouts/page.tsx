import { Shell, card, statGrid, StatCard, th, td } from '../ui';

interface Payout {
  id: string;
  cleaner: string;
  jobs: number;
  gross: number;
  fee: number;
  tax: number;
  status: '예정' | '보류' | '지급완료';
}

const rows: Payout[] = [
  { id: 'p-1', cleaner: '박지은 매니저', jobs: 14, gross: 910000, fee: 140000, tax: 30030, status: '예정' },
  { id: 'p-2', cleaner: '김서연 매니저', jobs: 9, gross: 585000, fee: 90000, tax: 19305, status: '지급완료' },
  { id: 'p-3', cleaner: '이도윤 매니저', jobs: 3, gross: 195000, fee: 30000, tax: 6435, status: '보류' },
  { id: 'p-4', cleaner: '최민준 매니저', jobs: 21, gross: 1365000, fee: 210000, tax: 45045, status: '예정' },
];

const STATUS_COLOR: Record<Payout['status'], string> = { 예정: '#6b7280', 보류: '#c2410c', 지급완료: '#047857' };

export default function PayoutsPage() {
  const scheduled = rows.filter((r) => r.status === '예정').reduce((s, r) => s + (r.gross - r.fee - r.tax), 0);
  const held = rows.filter((r) => r.status === '보류').length;

  return (
    <Shell title="정산 reconciliation">
      <section style={statGrid}>
        <StatCard label="지급 예정 합계" value={`₩${scheduled.toLocaleString()}`} />
        <StatCard label="보류" value={`${held}건`} warn={held > 0} />
        <StatCard label="이번 주기 청소사" value={`${rows.length}명`} />
      </section>

      <div style={{ ...card, marginTop: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>청소사</th>
              <th style={{ ...th, textAlign: 'right' }}>건수</th>
              <th style={{ ...th, textAlign: 'right' }}>총액</th>
              <th style={{ ...th, textAlign: 'right' }}>수수료</th>
              <th style={{ ...th, textAlign: 'right' }}>원천세(3.3%)</th>
              <th style={{ ...th, textAlign: 'right' }}>실지급</th>
              <th style={{ ...th, textAlign: 'right' }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.cleaner}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.jobs}</td>
                <td style={{ ...td, textAlign: 'right' }}>₩{r.gross.toLocaleString()}</td>
                <td style={{ ...td, textAlign: 'right', color: '#6b7280' }}>₩{r.fee.toLocaleString()}</td>
                <td style={{ ...td, textAlign: 'right', color: '#6b7280' }}>₩{r.tax.toLocaleString()}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>₩{(r.gross - r.fee - r.tax).toLocaleString()}</td>
                <td style={{ ...td, textAlign: 'right', color: STATUS_COLOR[r.status], fontWeight: 600 }}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
