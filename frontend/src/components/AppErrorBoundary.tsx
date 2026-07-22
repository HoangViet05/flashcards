import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/** Keeps a late chunk/runtime failure from leaving the whole app as a blank page. */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Flashcards render error', error, info)
  }

  reload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="app-recovery-screen mx-auto flex min-h-screen max-w-xl items-center px-5 py-12 text-center">
        <section className="app-recovery-card w-full p-7 sm:p-10">
          <div className="app-recovery-orbit" aria-hidden="true"><span>🛠️</span></div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[.2em] text-amber-200/80">Quick recovery</p>
          <h1 className="mt-2 text-2xl font-black text-white">Giao diện cần khởi động lại</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Có thể trang đang giữ một phiên bản cũ sau khi cập nhật. Dữ liệu học của bạn vẫn an toàn.
          </p>
          <div className="mt-6 flex justify-center gap-2 text-left"><span className="app-recovery-step">1. Làm mới</span><span className="app-recovery-step">2. Vào lại bài học</span></div>
          <button onClick={this.reload} className="app-recovery-button mt-7">
            Tải lại ứng dụng <span>↻</span>
          </button>
        </section>
      </main>
    )
  }
}
