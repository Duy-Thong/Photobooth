import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin } from 'antd'
import {
  CameraOutlined,
  PictureOutlined,
  PlaySquareOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  FireOutlined
} from '@ant-design/icons'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie
} from 'recharts'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { listenToSessions, type SessionData } from '@/lib/sessionService'

export default function StudioDashboard() {
  const { studioName, studioId } = useAdminAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [online] = useState(true)

  useEffect(() => {
    if (!studioId) return
    setLoading(true)
    const unsubscribe = listenToSessions((data) => {
      setSessions(data)
      setLoading(false)
    }, studioId)
    return () => unsubscribe()
  }, [studioId])

  // --- Aggregation Logic ---

  const stats = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const todayCount = sessions.filter(s => new Date(s.createdAt) >= startOfToday).length
    const videoCount = sessions.filter(s => !!s.videoUrl).length
    
    return {
      today: todayCount,
      total: sessions.length,
      videos: videoCount,
      online: true
    }
  }, [sessions])

  // 1. Daily Volume (Last 7 days)
  const dailyData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    }).reverse()

    return last7Days.map(date => {
      const count = sessions.filter(s => s.createdAt.startsWith(date)).length
      // Format date for display: "DD/MM"
      const [, m, d] = date.split('-')
      return { name: `${d}/${m}`, count }
    })
  }, [sessions])

  // 2. Hourly Peak (All time or last 30 days)
  const hourlyData = useMemo(() => {
    const hours = [...Array(24)].map((_, i) => ({ hour: i, count: 0 }))
    sessions.forEach(s => {
      const h = new Date(s.createdAt).getHours()
      hours[h].count++
    })
    return hours.map(h => ({
      name: `${h.hour}h`,
      count: h.count
    }))
  }, [sessions])

  // 3. Popular Frames
  const frameData = useMemo(() => {
    const counts: Record<string, number> = {}
    sessions.forEach(s => {
      const name = s.frameName || 'Mặc định/Ẩn'
      counts[name] = (counts[name] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [sessions])

  const chartTheme = {
    text: '#555',
    grid: 'rgba(255,255,255,0.03)',
    tooltip: {
      contentStyle: { backgroundColor: '#0d0d12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' },
      itemStyle: { color: '#fff' }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full min-h-full flex flex-col pt-8 md:pt-4">
      {/* Welcome Header */}
      <div className="mb-10 animate-fade-in group cursor-default">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
          Xin chào, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 group-hover:from-blue-300 group-hover:to-indigo-300 transition-colors">{studioName || 'Studio'}!</span>
          <span className="inline-block animate-wave">👋</span>
        </h1>
        <p className="text-[#888] text-sm md:text-base max-w-xl">
          Chào mừng trở lại. Đây là báo cáo chi tiết về hiệu quả vận hành của tiệm bạn.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {[
          { title: "Lượt chụp hôm nay", value: stats.today, icon: <ThunderboltOutlined className="text-yellow-400" />, desc: "Tăng trưởng so với hôm qua", color: "from-yellow-500/10" },
          { title: "Tổng lượt chụp", value: stats.total, icon: <PictureOutlined className="text-blue-400" />, desc: "Trong toàn bộ hệ thống", color: "from-blue-500/10" },
          { title: "Video Recap", value: stats.videos, icon: <PlaySquareOutlined className="text-purple-400" />, desc: "Đã được khách hàng quay", color: "from-purple-500/10" },
          { title: "Trạng thái Studio", value: "Online", icon: <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />, desc: "Máy đang sẵn sàng", color: "from-green-500/10" },
        ].map((stat, i) => (
          <div key={i} className="relative overflow-hidden bg-[#0d0d12] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r ${stat.color} to-transparent`}></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{stat.title}</span>
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">{stat.icon}</div>
            </div>
            <div className="text-3xl font-bold text-white">{loading ? <Spin size="small" /> : stat.value}</div>
            <div className="text-[10px] text-white/20 mt-1 font-medium">{stat.desc}</div>
          </div>
        ))}
      </div>

      {/* Advanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        
        {/* 1. Daily Growth Chart */}
        <div className="bg-[#0d0d12] border border-white/5 rounded-2xl p-6 shadow-xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-white font-bold flex items-center gap-2">
                <BarChartOutlined className="text-blue-400" />
                Lưu lượng chụp (7 ngày qua)
              </h3>
              <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Thống kê số lượt capture mỗi ngày</p>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip {...chartTheme.tooltip} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="count" fill="url(#blueGradient)" radius={[4, 4, 0, 0]} barSize={32}>
                  {dailyData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={0.8} />
                  ))}
                </Bar>
                <defs>
                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Peak Hours Analysis */}
        <div className="bg-[#0d0d12] border border-white/5 rounded-2xl p-6 shadow-xl animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-white font-bold flex items-center gap-2">
                <ClockCircleOutlined className="text-yellow-400" />
                Giờ cao điểm
              </h3>
              <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Tần suất khách chụp theo khung giờ</p>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" stroke={chartTheme.text} fontSize={10} tickLine={false} axisLine={false} interval={3} />
                <YAxis hide />
                <Tooltip {...chartTheme.tooltip} />
                <Line type="monotone" dataKey="count" stroke="#eab308" strokeWidth={3} dot={{ r: 4, fill: '#eab308', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Popular Frames List */}
        <div className="bg-[#0d0d12] border border-white/5 rounded-2xl p-6 shadow-xl animate-fade-in lg:col-span-2" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-white font-bold flex items-center gap-2">
                <FireOutlined className="text-red-400" />
                Khung ảnh xu hướng
              </h3>
              <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Top 5 khung ảnh được chọn nhiều nhất</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {frameData.length > 0 ? frameData.map((frame, i) => (
              <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all group">
                <div className="text-xs text-white/40 mb-1 font-bold uppercase tracking-tighter">Hạng #{i+1}</div>
                <div className="text-sm text-white font-bold truncate mb-3 group-hover:text-blue-400 transition-colors">{frame.name}</div>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-black text-white">{frame.count}</div>
                  <div className="text-[10px] text-white/20 mb-1">Lượt dùng</div>
                </div>
              </div>
            )) : (
              <div className="col-span-5 py-10 text-center text-white/20 text-xs italic">
                Chưa có dữ liệu về khung ảnh (Dữ liệu sẽ bắt đầu từ hôm nay)
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Main Action Hero */}
      <div className="relative p-[1px] rounded-3xl bg-gradient-to-b from-white/10 to-transparent mb-12 shadow-[0_0_40px_rgba(0,0,0,0.3)] overflow-hidden animate-fade-in" style={{ animationDelay: '0.5s' }}>
        <div className="relative bg-[#0d0d12] rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 h-full">
          <div className="flex-1 text-center md:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Cổng vận hành sẵn sàng
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight leading-tight">
              Bắt đầu ca làm việc mới.
            </h2>
            <p className="text-[#777] mb-8 max-w-sm mx-auto md:mx-0 text-xs md:text-sm leading-relaxed">
              Mở giao diện máy chụp cho khách. Hệ thống đang tự động tối ưu tốc độ xử lý ảnh và video recap.
            </p>
            <button
              onClick={() => navigate('/')}
              className="group relative inline-flex items-center gap-3 h-12 px-8 rounded-xl bg-white text-black font-bold text-sm hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all duration-300 ease-out"
            >
              Mở Giao Diện Chụp
              <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="flex-1 max-w-xs w-full relative z-10 hidden md:block opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-tr from-gray-900 to-[#111] border border-white/5 p-2 shadow-2xl relative overflow-hidden">
              <div className="w-full h-full border border-white/5 rounded-xl bg-black flex items-center justify-center">
                 <CameraOutlined className="text-white/20 text-4xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes wave {
          0%, 100% { transform: rotate(0.0deg) }
          25% { transform: rotate(14.0deg) }
          50% { transform: rotate(-8.0deg) }
          75% { transform: rotate(14.0deg) }
        }
        .animate-wave {
          animation: wave 2.5s infinite;
          transform-origin: 70% 70%;
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
      `}} />
    </div>
  )
}
