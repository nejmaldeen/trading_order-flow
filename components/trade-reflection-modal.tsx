"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Trash2, Check, X, Sparkles, Brain, Award } from "lucide-react";
import type { TradeReflection } from "@/lib/replay";

interface TradeReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reflection: TradeReflection) => void;
  initialData?: TradeReflection;
  tradeSummary?: {
    symbol: string;
    side: "long" | "short";
    price?: number | null;
    amount?: number;
  };
}

const SETUP_GRADES = ["A+", "A", "B+", "B", "C+"];

const STRATEGIES = [
  "Order Flow / سيولة",
  "كسر كاذب Fakeout",
  "إعادة اختبار Retest",
  "نموذج هارمونيك Harmonic",
  "دعم ومقاومة S&R",
  "استمرار الاتجاه Trend",
];

const EMOTIONS = [
  { label: "انضباط وهدوء", emoji: "🧘" },
  { label: "ثقة متوازنة", emoji: "🎯" },
  { label: "خوف الفوات FOMO", emoji: "⚡" },
  { label: "تردد وقلق", emoji: "⏱️" },
  { label: "انتقام من السوق", emoji: "⚠️" },
];

const CONFIDENCE_LEVELS = [
  "100% عالي جداً",
  "80% واثق",
  "60% معتدل",
  "40% متردد",
];

export default function TradeReflectionModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  tradeSummary,
}: TradeReflectionModalProps) {
  const [setupGrade, setSetupGrade] = useState<string>(initialData?.setupGrade ?? "A");
  const [strategy, setStrategy] = useState<string>(initialData?.strategy ?? "Order Flow / سيولة");
  const [emotion, setEmotion] = useState<string>(initialData?.emotion ?? "انضباط وهدوء");
  const [confidence, setConfidence] = useState<string>(initialData?.confidence ?? "80% واثق");
  const [notes, setNotes] = useState<string>(initialData?.notes ?? "");
  const [audioNote, setAudioNote] = useState<string | undefined>(initialData?.audioNote);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setSetupGrade(initialData?.setupGrade ?? "A");
    setStrategy(initialData?.strategy ?? "Order Flow / سيولة");
    setEmotion(initialData?.emotion ?? "انضباط وهدوء");
    setConfidence(initialData?.confidence ?? "80% واثق");
    setNotes(initialData?.notes ?? "");
    setAudioNote(initialData?.audioNote);
    setIsRecording(false);
    setRecordingSeconds(0);
  }, [initialData, isOpen]);

  // Clean up media recorder on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("التسجيل الصوتي غير مدعوم في هذا المتصفح.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioNote(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("يرجى إعطاء الإذن للميكروفون لتسجيل الملاحظة الصوتية.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const handleSave = () => {
    onSave({
      setupGrade,
      strategy,
      emotion,
      confidence,
      notes: notes.trim() || undefined,
      audioNote,
      createdAt: Date.now(),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="trade-reflection-overlay" dir="rtl">
      <div className="trade-reflection-card">
        <header className="reflection-header">
          <div className="title-group">
            <Award className="gold-icon" size={20} />
            <div>
              <h3>تحليل الدخول والانضباط النفسي</h3>
              <small>
                {tradeSummary
                  ? `${tradeSummary.side === "short" ? "بيع" : "شراء"} ${tradeSummary.symbol} ${
                      tradeSummary.price ? `· بسعر ${tradeSummary.price}` : ""
                    }`
                  : "سجل سبب دخولك وحالتك النفسية بنقرة واحدة"}
              </small>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="إغلاق">
            <X size={18} />
          </button>
        </header>

        <div className="reflection-body">
          {/* 1. Setup Grade */}
          <div className="field-section">
            <label className="section-label">
              <Award size={14} /> جودة الإعداد (Setup Grade)
            </label>
            <div className="pills-grid">
              {SETUP_GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  className={`grade-pill ${setupGrade === grade ? "selected" : ""}`}
                  onClick={() => setSetupGrade(grade)}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Strategy */}
          <div className="field-section">
            <label className="section-label">
              <Sparkles size={14} /> الاستراتيجية المستخدمة
            </label>
            <div className="pills-wrap">
              {STRATEGIES.map((strat) => (
                <button
                  key={strat}
                  type="button"
                  className={`option-pill ${strategy === strat ? "selected" : ""}`}
                  onClick={() => setStrategy(strat)}
                >
                  {strat}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Emotions & Psychology */}
          <div className="field-section">
            <label className="section-label">
              <Brain size={14} /> الحالة النفسية والشعور عند الدخول
            </label>
            <div className="pills-wrap">
              {EMOTIONS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`emotion-pill ${emotion === item.label ? "selected" : ""}`}
                  onClick={() => setEmotion(item.label)}
                >
                  <span>{item.emoji}</span> {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Confidence */}
          <div className="field-section">
            <label className="section-label">مستوى الثقة في الصفقة</label>
            <div className="pills-grid">
              {CONFIDENCE_LEVELS.map((conf) => (
                <button
                  key={conf}
                  type="button"
                  className={`option-pill ${confidence === conf ? "selected" : ""}`}
                  onClick={() => setConfidence(conf)}
                >
                  {conf}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Voice Note Audio Recorder */}
          <div className="field-section audio-section">
            <label className="section-label">
              <Mic size={14} /> تسجيل صوتي سريع (Voice Note)
            </label>
            <div className="audio-controls-row">
              {!isRecording ? (
                <button
                  type="button"
                  className="record-btn"
                  onClick={startRecording}
                  title="بدء التسجيل الصوتي"
                >
                  <Mic size={16} />
                  <span>{audioNote ? "إعادة التسجيل الصوتي" : "سجّل صوتك لشرح الدخول"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="record-btn recording"
                  onClick={stopRecording}
                  title="إيقاف وحفظ التسجيل"
                >
                  <Square size={16} />
                  <span>إيقاف التسجيل ({recordingSeconds} ثانية)</span>
                </button>
              )}

              {audioNote && !isRecording && (
                <div className="audio-preview">
                  <audio src={audioNote} controls />
                  <button
                    type="button"
                    className="delete-audio"
                    onClick={() => setAudioNote(undefined)}
                    title="حذف التسجيل"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 6. Optional text note */}
          <div className="field-section">
            <label className="section-label">ملاحظات كتابية إضافية (اختياري)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب أي ملاحظة سريعة حول الشارت، السلوك السعري، أو إدارة المخاطرة…"
              rows={2}
              maxLength={400}
            />
          </div>
        </div>

        <footer className="reflection-footer">
          <button className="skip-btn" onClick={onClose}>
            تخطي الآن
          </button>
          <button className="save-btn" onClick={handleSave}>
            <Check size={16} />
            <span>حفظ ومتابعة الصفقة</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
