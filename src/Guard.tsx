// 렌더 예외가 나도 흰 화면 대신 복구 화면을 보여 준다(비동기·GPU 문제까지 막지는 못한다).
// 원칙: 재시도와 저장 원본 보기를 먼저, 삭제는 두 단계 명시 확인 후에만.
import React from 'react';
export class Guard extends React.Component<{}, { err: string; wipe: boolean; wipeErr: boolean }> {
    state = { err: '', wipe: false, wipeErr: false };
    static getDerivedStateFromError(e: any) { return { err: String((e && e.message) || e) }; }
    render() {
        if (!this.state.err) return this.props.children;
        let raw = '';
        try { raw = localStorage.getItem('rookie-soccer.v1') || ''; } catch { }
        return <main className="ui-card" style={{ margin: '24px auto', maxWidth: 480, padding: 16 }}>
            <h1 className="ui-title">화면을 표시하지 못했다</h1>
            <p className="ui-callout">일시적인 문제일 수 있다. 진행 데이터는 이 브라우저 저장소에 남아 있을 수 있다. ({this.state.err})</p>
            <div className="rs-row"><button type="button" className="file-button is-compact" onClick={() => this.setState({ err: '' })}>다시 시도</button></div>
            {raw && <details className="rs-info"><summary>저장 원본 보기(원문 JSON — 보관용, 고친 뒤 복구 입력에 붙여 복원 가능)</summary><textarea className="rs-input" readOnly style={{ width: '100%', minHeight: 64, boxSizing: 'border-box' }} value={raw} /></details>}
            {!this.state.wipe
                ? <p className="rs-hint"><button type="button" className="file-button is-compact" data-variant="secondary" onClick={() => this.setState({ wipe: true, wipeErr: false })}>저장을 지우고 새로 시작</button></p>
                : <p className="rs-hint">정말 저장을 지울까? 되돌릴 수 없다. <button type="button" className="file-button is-compact" data-variant="secondary" onClick={() => { try { localStorage.removeItem('rookie-soccer.v1'); if (localStorage.getItem('rookie-soccer.v1') !== null) throw new Error('removal not applied'); this.setState({ err: '', wipe: false }); } catch { this.setState({ wipeErr: true }); } }}>삭제 확인</button></p>}
            {this.state.wipeErr && <p className="ui-callout">저장을 지우지 못해 새로 시작을 멈췄다. 저장된 데이터는 그대로다. 브라우저 저장 설정을 확인한 뒤 다시 시도해 달라.</p>}
        </main>;
    }
}
