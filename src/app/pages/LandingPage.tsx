import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import '../../styles/landing.css'

interface ReviewItem {
  stars: string
  content: string
  name: string
  role: string
  avatar: string
}

const REVIEWS: ReviewItem[] = [
  {
    stars: '★★★★★',
    content:
      '"Sách bám sát bài học trên trường của con. Đi làm về mẹ không cần phải ngồi kèm từng câu nữa, con tự làm bài rồi quét app kiểm tra, sai câu nào con tự đọc gợi ý để sửa lại."',
    name: 'Chị Hồng Nhung',
    role: 'Phụ huynh học sinh lớp 6, Cầu Giấy (Hà Nội)',
    avatar: 'HN',
  },
  {
    stars: '★★★★★',
    content:
      '"Sách in màu rõ ràng, chia bài đúng theo các mục A Closer Look, Skills trên lớp. Con nắm chắc kiến thức cơ bản nên bài kiểm tra trên trường tự tin hơn hẳn."',
    name: 'Anh Tuấn Hùng',
    role: 'Phụ huynh học sinh lớp 6, Quận 1 (TP.HCM)',
    avatar: 'TH',
  },
  {
    stars: '★★★★★',
    content:
      '"Bộ sách do thầy cô có chuyên môn biên soạn nên cách đặt câu hỏi rất sư phạm. Phần gợi ý giúp con tự nhớ lại bài giảng sáng nay của cô giáo trên lớp chứ không đưa sẵn đáp án."',
    name: 'Chị Mai Lan',
    role: 'Giáo viên & Phụ huynh học sinh lớp 6 (Đà Nẵng)',
    avatar: 'ML',
  },
  {
    stars: '★★★★★',
    content:
      '"Rất thích vì con chủ yếu viết trên sách giấy, không bị dán mắt vào điện thoại chơi game. App chỉ dùng 3-5 phút cuối để kiểm tra kết quả rất tiện lợi."',
    name: 'Anh Văn Thắng',
    role: 'Phụ huynh học sinh lớp 6, Ba Đình (Hà Nội)',
    avatar: 'VT',
  },
  {
    stars: '★★★★★',
    content:
      '"Mức giá rất hợp lý cho trọn gói cả năm học. Con tự giác học và rèn được tính tự lập, ba mẹ theo dõi được con hoàn thành bao nhiêu phần trăm bài học."',
    name: 'Chị Quỳnh Liên',
    role: 'Phụ huynh học sinh lớp 6, Hải Châu (Đà Nẵng)',
    avatar: 'QL',
  },
]

interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: 'GSEC có thay thế sách giáo khoa trên lớp không?',
    answer:
      'Không. Sách giáo khoa là chương trình chuẩn trên trường. GSEC là bộ học liệu bổ trợ bám theo từng bài học SGK, giúp con luyện tập sâu hơn ở nhà để nắm vững kiến thức thầy cô đã dạy.',
  },
  {
    question: 'Con có phải dùng điện thoại hay máy tính suốt buổi học không?',
    answer:
      'Không. Hơn 80% thời gian con làm việc trực tiếp trên trang sách giấy. Ứng dụng chỉ được mở trong vài phút cuối buổi để kiểm tra kết quả và đọc gợi ý sửa bài khi cần.',
  },
  {
    question: 'Con tôi học lực trung bình thì có tự học được không?',
    answer:
      'Hoàn toàn phù hợp. Bài tập được chia nhỏ theo mức độ vừa sức. Khi con làm sai, ứng dụng đưa ra gợi ý nhẹ nhàng nhắc lại quy tắc trên lớp để con tự tìm ra cách sửa đúng.',
  },
  {
    question: 'Chính sách cam kết hỗ trợ và trải nghiệm vận hành như thế nào?',
    answer:
      'Hệ thống mở sẵn các bài học trải nghiệm cho học sinh tự học tại nhà. Phụ huynh và học sinh có thể trải nghiệm toàn diện bài tập, nghe audio, chấm AI và nhận gợi ý sửa bài ngay trên website.',
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile } = useAuth()

  // Điều hướng tương thích ngược nếu truy cập link có param bài tập hoặc mode
  useEffect(() => {
    const pageParam = searchParams.get('page')
    const modeParam = searchParams.get('mode')
    if (pageParam || modeParam) {
      navigate(`/student?${searchParams.toString()}`, { replace: true })
    }
  }, [searchParams, navigate])

  // Xử lý nút Trải Nghiệm Bộ Học Liệu GSEC
  const handleExperienceClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    if (!user) {
      navigate('/login', { state: { from: '/student' } })
    } else if (profile?.role === 'ADMIN') {
      navigate('/admin')
    } else if (profile?.role === 'TEACHER') {
      navigate('/teacher')
    } else {
      navigate('/student')
    }
  }

  // Quản lý FAQ Accordion
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)
  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index))
  }

  // Quản lý Carousel Đánh Giá
  const reviewTrackRef = useRef<HTMLDivElement>(null)
  const [activeReviewIndex, setActiveReviewIndex] = useState(0)

  const scrollToReview = (index: number) => {
    if (reviewTrackRef.current) {
      const card = reviewTrackRef.current.querySelector<HTMLElement>('.carousel-card')
      const cardWidth = (card?.offsetWidth || 300) + 20
      reviewTrackRef.current.scrollTo({ left: index * cardWidth, behavior: 'smooth' })
      setActiveReviewIndex(index)
    }
  }

  const slideReviews = (direction: number) => {
    if (reviewTrackRef.current) {
      const card = reviewTrackRef.current.querySelector<HTMLElement>('.carousel-card')
      const cardWidth = (card?.offsetWidth || 300) + 20
      reviewTrackRef.current.scrollBy({ left: direction * cardWidth, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const track = reviewTrackRef.current
    if (!track) return
    const handleScroll = () => {
      const card = track.querySelector<HTMLElement>('.carousel-card')
      const cardWidth = (card?.offsetWidth || 300) + 20
      const currentIdx = Math.round(track.scrollLeft / cardWidth)
      setActiveReviewIndex(Math.max(0, Math.min(REVIEWS.length - 1, currentIdx)))
    }
    track.addEventListener('scroll', handleScroll, { passive: true })
    return () => track.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="gsec-landing-page">
      {/* HEADER & NAV */}
      <header className="landing-header">
        <div className="container nav">
          <Link to="/" className="logo">
            <span>🎓 GSEC</span>
            <span className="logo-badge">Hybrid 3.0</span>
          </Link>

          <nav className="nav-links" aria-label="Menu chính">
            <a href="#founders">Chuyên gia biên soạn</a>
            <a href="#chuong-trinh">Bám sát SGK</a>
            <a href="#cach-hoc">Cách con tự học</a>
            <a href="#so-sanh">Khác biệt Hybrid</a>
            <a href="#danh-gia">Đánh giá</a>
            <a href="#faq">Hỏi đáp</a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!user ? (
              <>
                <Link
                  to="/login"
                  state={{ from: '/student' }}
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: 'var(--t-sub)',
                    padding: '8px 12px',
                  }}
                >
                  Đăng nhập
                </Link>
                <button
                  type="button"
                  className="btn p landing-header-cta"
                  onClick={handleExperienceClick}
                  style={{ padding: '9px 18px', fontSize: '13px', minHeight: '38px' }}
                >
                  Trải Nghiệm GSEC
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn p"
                onClick={handleExperienceClick}
                style={{ padding: '9px 18px', fontSize: '13px', minHeight: '38px' }}
              >
                {profile?.role === 'ADMIN'
                  ? '🛠️ Vào Admin'
                  : profile?.role === 'TEACHER'
                  ? '🏫 Cổng Giáo Viên'
                  : '🎒 Bàn Phím Học Sinh'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* KHỐI 01: HERO & HOOK */}
      <section className="sec sec-alt">
        <div className="container g2">
          <div>
            <div className="pill">⚡ Sách bổ trợ Global Success 6</div>
            <h1>
              Vững kiến thức SGK
              <br />
              <span style={{ color: 'var(--p)' }}>Tự tin tự học tại nhà</span>
            </h1>
            <p className="lead">
              • GSEC được xây dựng bởi đội ngũ học thuật uy tín, giúp học sinh củng cố kiến thức,
              luyện 4 kỹ năng và tự học có hướng dẫn tại nhà theo Khung chương trình của Global
              Success.
              <br />• GSEC là sách học tiếng Anh thế hệ mới, kết hợp Sách và App AI thông minh.
            </p>

            <div className="btns">
              <button
                type="button"
                className="btn p"
                onClick={handleExperienceClick}
              >
                Trải Nghiệm Bộ Học Liệu GSEC →
              </button>
              <a className="btn s" href="#cach-hoc">
                Xem Quy Trình Tự Học 15 Phút
              </a>
            </div>

            {/* Trust Badges */}
            <div className="trust-strip">
              <div>
                <div className="trust-val">100% SGK</div>
                <div className="trust-lbl">Bám sát nội dung học tập từng tiết trên lớp</div>
              </div>
              <div>
                <div className="trust-val" style={{ color: 'var(--p)' }}>
                  4 kỹ năng
                </div>
                <div className="trust-lbl">Học tập toàn diện với Nghe Nói Đọc Viết</div>
              </div>
              <div>
                <div className="trust-val" style={{ color: 'var(--success)' }}>
                  2 trong 1
                </div>
                <div className="trust-lbl">Kết hợp Sách và App tạo nên giá trị vượt trội</div>
              </div>
            </div>
          </div>

          {/* Hero Hybrid Visual */}
          <div className="hero-visual-wrap">
            <div className="hero-photo-frame">
              <img
                src="https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=85&w=1200"
                alt="Học sinh tự giác làm bài tập tiếng Anh cùng sách GSEC"
              />
              <div className="hero-photo-tag">
                <span>Học sinh tự học tại nhà • 15 phút mỗi tối</span>
              </div>
            </div>

            {/* Floating Card UI */}
            <div className="floating-ui-card">
              <div className="floating-ui-header">
                <span className="floating-ui-status">GSEC Companion • Bổ trợ tự học</span>
                <span style={{ fontSize: '11px', color: 'var(--t-muted)' }}>Unit 2 · P.38</span>
              </div>
              <div className="floating-hint-box">
                <b>Gợi ý bài học sáng nay:</b> Khi đã dùng trợ động từ <i>"doesn't"</i>, động từ
                chính theo sau có còn giữ đuôi "-s/-es" không? Con kiểm tra lại câu 3 nhé!
              </div>
              <div className="floating-ui-footer">
                <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '12px' }}>
                  ✓ Con tự phát hiện & sửa đúng: "doesn't like"
                </span>
                <span
                  style={{
                    background: '#E2E8F0',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    fontSize: '10px',
                  }}
                >
                  Độc lập
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KHỐI 02: AUTHORITY TRUST - ĐỘI NGŨ CHUYÊN GIA */}
      <section className="sec" id="founders">
        <div className="container">
          <div className="ey">02 / Đội ngũ chuyên gia</div>
          <h2>Được xây dựng bởi các chuyên gia học thuật uy tín.</h2>
          <p className="lead">
            GSEC được xây dựng trên nền tảng chuyên môn về giảng dạy tiếng Anh, chương trình phổ
            thông và ứng dụng công nghệ trong giáo dục.
          </p>

          <div className="g2-eq" style={{ marginTop: '24px' }}>
            {/* Founder 1 */}
            <div className="founder-card">
              <div className="founder-image">
                <img
                  src="https://dl.dropboxusercontent.com/s/t8jrlz1mmuxlfatlfma3t/Mr-T-ng-c.jpg?rlkey=sfqiwj8ubkcvpidzwodzw6umo&st=coevn3i2&dl=0"
                  alt="Thầy Hoàng Tăng Đức"
                />
              </div>
              <div className="founder-content">
                <span className="badge-tag">Đồng Sáng Lập & Chủ Biên Học Thuật</span>
                <h3>Thầy Hoàng Tăng Đức</h3>
                <p className="sub" style={{ marginBottom: '10px' }}>
                  Thạc sỹ Phương pháp Giảng dạy Tiếng Anh. Hơn 30 năm nghiên cứu chương trình phổ
                  thông và đào tạo chuyên môn cho hàng nghìn giáo viên tiếng Anh.
                </p>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t-main)' }}>
                  • Cố vấn chuyên môn các chương trình bám sát SGK
                </div>
              </div>
            </div>

            {/* Founder 2 */}
            <div className="founder-card">
              <div className="founder-image">
                <img
                  src="https://dl.dropboxusercontent.com/s/46perhzi9vo7t69q5x9py/Mai-Linh.jpg?rlkey=cnjnkn0gmn9z113qiw89mdkc3&st=spfrt3jf&dl=0"
                  alt="Cô Mai Linh"
                />
              </div>
              <div className="founder-content">
                <span className="badge-tag">Đồng Sáng Lập</span>
                <h3>Cô Mai Linh</h3>
                <p className="sub" style={{ marginBottom: '10px' }}>
                  Theo đuổi triết lý Tiếng Anh vì sự phát triển con người. Tiên phong đổi mới kết
                  hợp giảng dạy truyền thống và công nghệ.
                </p>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t-main)' }}>
                  • Sáng lập Pinta English và phương pháp Tiếng Anh Tư duy
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KHỐI 03: PAIN VS SOLUTION - HỌC ĐÚNG HỌC SÂU */}
      <section className="sec sec-alt" id="chuong-trinh">
        <div className="container">
          <div className="ey">03 / Học đúng - Học sâu</div>
          <h2>Học trên lớp đến đâu, GSEC đồng hành đến đó.</h2>
          <p className="lead">
            GSEC không chỉ bám sát nội dung Global Success, mà còn mở rộng việc luyện tập theo
            hướng phát triển 4 kỹ năng, khả năng tự học và theo dõi tiến bộ của học sinh.
          </p>

          <div className="g2-eq" style={{ marginTop: '24px' }}>
            <div className="card" style={{ background: '#F9FAFB' }}>
              <h3
                style={{
                  color: 'var(--t-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>❌</span> Sách bổ trợ thông thường
              </h3>
              <ul
                style={{
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginTop: '12px',
                  fontSize: '13.5px',
                  color: 'var(--t-sub)',
                }}
              >
                <li>• Tập trung luyện thêm từ vựng, ngữ pháp theo từng Unit.</li>
                <li>• Làm bài, ôn tập và đối chiếu đáp án sau khi hoàn thành.</li>
                <li>• Học sinh cần giáo viên giải đáp, hướng dẫn học.</li>
                <li>• Không lưu giữ nhật ký và feedback học tập.</li>
              </ul>
            </div>

            <div
              className="card"
              style={{ borderColor: 'var(--p-border)', background: 'var(--p-tint)' }}
            >
              <h3
                style={{
                  color: 'var(--p)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>✓</span> Sách GSEC-6
              </h3>
              <ul
                style={{
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginTop: '12px',
                  fontSize: '13.5px',
                  color: 'var(--t-main)',
                }}
              >
                <li>• Nội dung rộng mở theo hướng phát triển 4 kỹ năng.</li>
                <li>• App hỗ trợ kiểm tra, phản hồi và gợi ý học tập.</li>
                <li>• Sách thiết kế theo hướng nâng cao năng lực tự học.</li>
                <li>• Hệ thống lưu quá trình, kết quả và dự báo học tập.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* KHỐI 04: HYBRID IN ACTION - 15 PHÚT MỖI BÀI */}
      <section className="sec" id="cach-hoc">
        <div className="container">
          <div className="ey">04 / Cơ chế tự học</div>
          <h2>15 phút mỗi bài.</h2>
          <p className="lead">
            Nội dung được thiết kế kỹ lưỡng, để làm trong 15 phút nhưng cover toàn bộ các kiến thức
            con cần. Con làm chủ hoàn toàn quá trình học. App chỉ xuất hiện để kiểm tra và gợi ý khi
            con gặp khó.
          </p>

          <div className="flow-3">
            <div className="flow-box">
              <span className="step-time">10 Phút</span>
              <div className="step-num">1</div>
              <h3>Học với Sách</h3>
              <p className="sub">
                Con mở sách GSEC-6, đọc đề và đặt bút viết câu trả lời trực tiếp lên trang sách.
              </p>
            </div>
            <div className="flow-box">
              <span className="step-time">2 Phút</span>
              <div className="step-num">2</div>
              <h3>Kiểm tra với App</h3>
              <p className="sub">
                Mở app kiểm tra nhanh kết quả. Hệ thống báo rõ câu làm đúng và khoanh vùng những câu
                làm sai.
              </p>
            </div>
            <div className="flow-box">
              <span className="step-time">3 Phút</span>
              <div className="step-num">3</div>
              <h3>Tự sửa bài</h3>
              <p className="sub">
                Đọc gợi ý (Hint) của app để nhớ lại bài học trên trường, tự tẩy xóa và sửa lại câu
                đúng trên sách.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* KHỐI 05: THE TRUE HYBRID MATRIX */}
      <section className="sec sec-dark" id="so-sanh">
        <div className="container">
          <div style={{ maxWidth: '760px' }}>
            <div className="ey">05 / Sách Hybrid cao cấp</div>
            <h2 style={{ color: '#fff' }}>Trải nghiệm và Giá trị học ở tầm cao mới.</h2>
            <p style={{ color: 'var(--dark-muted)', fontSize: '15px' }}>
              Sách tiếng Anh thông thường sử dụng mã QRCode để mở file audio/video giúp con nhận input
              1 chiều.
              <br />
              GSEC cung cấp hệ thống phản hồi giúp con tự phát hiện và sửa lỗi độc lập đi kèm với
              Sách.
            </p>
          </div>

          {/* Desktop Table */}
          <div className="table-desktop">
            <table className="dark-tab">
              <thead>
                <tr>
                  <th>Tiêu chuẩn đánh giá</th>
                  <th>Sách thường</th>
                  <th>Sách kèm mã QR</th>
                  <th className="col-hi">Sách GSEC (Hybrid)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1. Không gian học</td>
                  <td>Chỉ sách giấy</td>
                  <td>Chỉ sách giấy</td>
                  <td className="col-hi">
                    <span style={{ color: '#FBBF24', marginRight: '6px' }}>★</span>
                    <b>Sách giấy + App + AI</b>
                  </td>
                </tr>
                <tr>
                  <td>2. Khi học sinh làm sai</td>
                  <td className="dash">Xem key sau sách</td>
                  <td className="dash">Xem key và video giải sẵn</td>
                  <td className="col-hi">
                    <span className="check">✓</span> App phản hồi, con tự sửa
                  </td>
                </tr>
                <tr>
                  <td>3. Theo dõi tiến bộ</td>
                  <td className="dash">Không</td>
                  <td className="dash">Không</td>
                  <td className="col-hi">
                    <span className="check">✓</span> Ghi nhận và báo cáo Kết quả
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="cards-mobile">
            <div className="comp-card-m">
              <div className="comp-title-m">1. Không gian học</div>
              <div className="comp-row-m">
                <span style={{ color: 'var(--dark-muted)' }}>Sách thông thường:</span>{' '}
                <span>Chỉ Sách giấy</span>
              </div>
              <div className="comp-row-m">
                <span style={{ color: 'var(--dark-muted)' }}>Sách kèm mã QR:</span>{' '}
                <span>Chỉ Sách giấy</span>
              </div>
              <div className="comp-highlight-m">
                <div
                  style={{
                    fontSize: '11px',
                    color: '#E05DA5',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Sách GSEC (Hybrid)
                </div>
                <div style={{ color: '#fff', fontWeight: 600, marginTop: '2px' }}>
                  Sách giấy + App + AI
                </div>
              </div>
            </div>

            <div className="comp-card-m">
              <div className="comp-title-m">2. Khi học sinh làm sai</div>
              <div className="comp-row-m">
                <span style={{ color: 'var(--dark-muted)' }}>Sách thông thường:</span>{' '}
                <span className="dash">Xem key sau sách</span>
              </div>
              <div className="comp-row-m">
                <span style={{ color: 'var(--dark-muted)' }}>Sách kèm mã QR:</span>{' '}
                <span className="dash">Tự xem Video giải sẵn</span>
              </div>
              <div className="comp-highlight-m">
                <div
                  style={{
                    fontSize: '11px',
                    color: '#E05DA5',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Sách GSEC (Hybrid)
                </div>
                <div style={{ color: '#fff', fontWeight: 600, marginTop: '2px' }}>
                  <span className="check">✓</span> App phản hồi, con tự sửa
                </div>
              </div>
            </div>

            <div className="comp-card-m">
              <div className="comp-title-m">3. Theo dõi tiến bộ</div>
              <div className="comp-row-m">
                <span style={{ color: 'var(--dark-muted)' }}>Sách thông thường:</span>{' '}
                <span className="dash">Không</span>
              </div>
              <div className="comp-row-m">
                <span style={{ color: 'var(--dark-muted)' }}>Sách kèm mã QR:</span>{' '}
                <span className="dash">Không</span>
              </div>
              <div className="comp-highlight-m">
                <div
                  style={{
                    fontSize: '11px',
                    color: '#E05DA5',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Sách GSEC (Hybrid)
                </div>
                <div style={{ color: '#fff', fontWeight: 600, marginTop: '2px' }}>
                  <span className="check">✓</span> Ghi nhận & báo cáo Kết quả
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KHỐI 06: PARENT RELIEF & SOCIAL PROOF */}
      <section className="sec sec-alt" id="danh-gia">
        <div className="container">
          <div className="ey">06 / Trải nghiệm thực tế</div>
          <h2>Ba mẹ an tâm. Con tự giác học bài mỗi ngày.</h2>
          <p className="lead">
            Rất nhiều phụ huynh học sinh lớp 6 đã tin chọn GSEC-6 đồng hành cùng con tự học tại nhà.
          </p>

          <div className="carousel-container">
            <div className="carousel-track" ref={reviewTrackRef} id="reviewTrack">
              {REVIEWS.map((rev, idx) => (
                <div className="carousel-card" key={idx}>
                  <div>
                    <div className="review-stars">{rev.stars}</div>
                    <p style={{ fontSize: '13.5px', color: 'var(--t-sub)', lineHeight: 1.6 }}>
                      {rev.content}
                    </p>
                  </div>
                  <div className="reviewer">
                    <div className="reviewer-avt">{rev.avatar}</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{rev.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--t-muted)' }}>{rev.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="carousel-nav-wrap">
              <div className="carousel-dots" id="carouselDots">
                {REVIEWS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`dot ${activeReviewIndex === idx ? 'active' : ''}`}
                    onClick={() => scrollToReview(idx)}
                    aria-label={`Chuyển tới nhận xét ${idx + 1}`}
                  />
                ))}
              </div>
              <div className="carousel-btns">
                <button
                  type="button"
                  className="c-btn"
                  onClick={() => slideReviews(-1)}
                  aria-label="Slide trước"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="c-btn"
                  onClick={() => slideReviews(1)}
                  aria-label="Slide tiếp"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KHỐI CTA TRẢI NGHIỆM GSEC NỔI BẬT */}
      <section className="sec" style={{ background: 'var(--p-tint)' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '780px' }}>
          <div className="ey">Bắt đầu ngay hôm nay</div>
          <h2>Sẵn Sàng Nâng Tầm Điểm Số Tiếng Anh Cùng GSEC?</h2>
          <p className="lead" style={{ margin: '12px auto 24px' }}>
            Khám phá phương pháp học Hybrid thông minh: Nhập mã bài tập SGK 5 chữ số, nghe audio chuẩn
            bản xứ, tương tác AI và tự sửa lỗi tức thì.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn p"
              onClick={handleExperienceClick}
              style={{ fontSize: '15px', padding: '14px 28px' }}
            >
              Trải Nghiệm Bộ Học Liệu GSEC →
            </button>
            <Link
              to="/login"
              state={{ from: '/student' }}
              className="btn s"
              style={{ fontSize: '15px', padding: '14px 24px' }}
            >
              Đăng Nhập Tài Khoản
            </Link>
          </div>
        </div>
      </section>

      {/* KHỐI 08: RISK-FREE FAQ */}
      <section className="sec sec-alt" id="faq">
        <div className="container">
          <div className="ey">08 / Giải đáp thắc mắc</div>
          <h2>Những câu hỏi phụ huynh thường quan tâm.</h2>

          <div className="faq-wrap">
            {FAQS.map((faq, idx) => (
              <div className={`faq-item ${openFaqIndex === idx ? 'open' : ''}`} key={idx}>
                <div className="faq-q" onClick={() => toggleFaq(idx)}>
                  {faq.question}
                  <span className="faq-icon">▼</span>
                </div>
                {openFaqIndex === idx && <div className="faq-a">{faq.answer}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '36px 0', background: '#0B060F', color: '#9CA3AF', fontSize: '13px' }}>
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <b style={{ color: '#fff', fontSize: '15px' }}>
              GSEC — Global Success English Coach
            </b>
            <p style={{ marginTop: '4px', fontSize: '12px' }}>
              Hệ thống học tập Hybrid bổ trợ bám sát chương trình tiếng Anh phổ thông.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '18px', fontSize: '12px' }}>
            <button
              type="button"
              onClick={handleExperienceClick}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                font: 'inherit',
                padding: 0,
              }}
            >
              Trải nghiệm học liệu
            </button>
            <Link to="/login" style={{ color: 'inherit' }}>
              Đăng nhập
            </Link>
            <Link to="/register" style={{ color: 'inherit' }}>
              Đăng ký
            </Link>
          </div>
        </div>
      </footer>

      {/* MOBILE STICKY BOTTOM BAR */}
      <div className="sticky-bar">
        <div className="sticky-inner">
          <div>
            <div style={{ fontSize: '11px', color: 'var(--t-muted)' }}>Bộ học liệu GSEC Lớp 6</div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--p)' }}>
              Tự học Hybrid SGK
            </div>
          </div>
          <button
            type="button"
            className="btn p"
            onClick={handleExperienceClick}
            style={{ minHeight: '40px', padding: '8px 16px', fontSize: '13px' }}
          >
            TRẢI NGHIỆM GSEC
          </button>
        </div>
      </div>
    </div>
  )
}
