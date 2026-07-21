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
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-12 text-center">
        <section className="w-full rounded-3xl border border-amber-300/20 bg-slate-950/80 p-7 shadow-2xl sm:p-10">
          <p className="text-4xl">⚠️</p>
          <h1 className="mt-4 text-2xl font-black text-white">Không thể tải giao diện</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Có thể trang đang giữ một phiên bản cũ sau khi cập nhật. Dữ liệu học của bạn vẫn an toàn.
          </p>
          <button onClick={this.reload} className="mt-6 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-100">
            Tải lại ứng dụng
          </button>
        </section>
      </main>
    )
  }
}
