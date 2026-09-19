
(() => {
  const toast = document.getElementById('toast');
  let toastTimer;
  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  };

  document.querySelectorAll('[data-scroll]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = document.querySelector(el.dataset.scroll);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  document.querySelectorAll('[data-toast]').forEach((el) => {
    el.addEventListener('click', () => showToast(el.dataset.toast));
  });

  const diagnosisDialog = document.getElementById('diagnosisDialog');
  const startDiagnosis = document.getElementById('startDiagnosis');
  if (startDiagnosis && diagnosisDialog) startDiagnosis.addEventListener('click', () => diagnosisDialog.showModal());

  const diagnosisForm = document.getElementById('diagnosisForm');
  const finishDiagnosis = document.getElementById('finishDiagnosis');
  if (diagnosisForm && finishDiagnosis) {
    finishDiagnosis.addEventListener('click', (event) => {
      event.preventDefault();
      if (!diagnosisForm.reportValidity()) return;
      const data = new FormData(diagnosisForm);
      localStorage.setItem('academy_diagnosis', JSON.stringify({
        timeline: data.get('timeline'),
        blocker: data.get('blocker'),
        budget: data.get('budget'),
        at: new Date().toISOString()
      }));
      diagnosisDialog.close();
      const blocker = String(data.get('blocker') || '');
      const message = blocker.includes('매물') ? '다음 행동: 매물 탐색 기준부터 정리하세요.' :
        blocker.includes('수익성') ? '다음 행동: 수익성 계산 기준부터 익히세요.' :
        blocker.includes('세팅') ? '다음 행동: 오픈 필수 세팅 체크리스트부터 만드세요.' :
        blocker.includes('운영') ? '다음 행동: 예약·청소·CS 운영 흐름부터 익히세요.' :
        '다음 행동: 숙박업 오픈 전체 로드맵부터 확인하세요.';
      showToast(message);
      document.getElementById('roadmap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const enrollDialog = document.getElementById('enrollDialog');
  document.querySelectorAll('#startPaidCourse, .continue').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      if (enrollDialog) enrollDialog.showModal();
    });
  });

  const purchaseConfirm = document.getElementById('purchaseConfirm');
  const goPayment = document.getElementById('goPayment');
  if (purchaseConfirm && goPayment) {
    purchaseConfirm.addEventListener('change', () => { goPayment.disabled = !purchaseConfirm.checked; });
    goPayment.addEventListener('click', () => {
      localStorage.setItem('academy_checkout_intent', JSON.stringify({
        product: '숙박업 완전초보 오픈 실전',
        amount: 100000,
        at: new Date().toISOString()
      }));
      enrollDialog?.close();
      showToast('결제 전 준비 완료. 다음 단계에서 실제 결제모듈을 연결합니다.');
    });
  }

  const courseSearch = document.getElementById('courseSearch');
  if (courseSearch) {
    courseSearch.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const q = courseSearch.value.trim();
      if (!q) return showToast('검색어를 입력해주세요.');
      document.getElementById('courses')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('현재 대표과정 1개를 우선 운영 중입니다: 숙박업 완전초보 오픈 실전');
    });
  }

  document.querySelectorAll('.tabs button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      showToast(button.textContent.trim() + ' 게시글만 보도록 선택했습니다.');
    });
  });

  document.querySelectorAll('.mission-btn,.join-btn,.write-btn,.invite-card button').forEach((button) => {
    button.addEventListener('click', () => showToast('이 기능은 수강 활성화 단계에서 연결됩니다.'));
  });
})();
