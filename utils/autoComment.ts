/**
 * Auto-comment generator for student progress reports.
 * Generates rich Vietnamese comments based on:
 * 1. Current score level — 8 detailed bands on a /10 scale
 * 2. Trend vs previous month (up/down/stable) with contextual phrasing
 * 3. Score stability (variance within the month)
 * 
 * This is a pure function — safe for both frontend and backend use.
 */

export interface ScoreHistory {
    month: string;    // "YYYY-MM"
    avgScore: number;
}

export type ScoreLevel = 'outstanding' | 'excellent' | 'good' | 'above_avg' | 'average' | 'below_avg' | 'weak' | 'very_weak';
export type ScoreTrend = 'up' | 'stable' | 'down' | 'new';

export interface AutoCommentResult {
    comment: string;
    level: ScoreLevel;
    levelLabel: string;
    trend: ScoreTrend;
    trendDelta: number; // positive = improvement
}

// ===== Score Level Classification — 8 bands on /10 =====

interface LevelInfo {
    level: ScoreLevel;
    label: string;
    /** Base comment about knowledge/attitude — no score number (added separately) */
    comments: string[];
}

const SCORE_BANDS: { min: number; info: LevelInfo }[] = [
    {
        min: 9.0,
        info: {
            level: 'outstanding',
            label: 'Xuất sắc',
            comments: [
                'Nắm vững kiến thức, thể hiện tư duy sáng tạo và khả năng vận dụng tốt.',
                'Kiến thức vững chắc, tích cực phát biểu và hoàn thành bài tập rất tốt.',
                'Học tập rất nghiêm túc, hiểu bài sâu và áp dụng linh hoạt.',
            ],
        },
    },
    {
        min: 8.0,
        info: {
            level: 'excellent',
            label: 'Giỏi',
            comments: [
                'Kiến thức tốt, chăm chỉ và có ý thức học tập cao.',
                'Nắm bài khá vững, hoàn thành tốt các bài tập và kiểm tra.',
                'Học tập tích cực, tiếp thu nhanh và có kết quả ấn tượng.',
            ],
        },
    },
    {
        min: 6.5,
        info: {
            level: 'good',
            label: 'Khá',
            comments: [
                'Nắm được kiến thức cơ bản, cần rèn luyện thêm để vươn lên Giỏi.',
                'Hiểu bài tương đối tốt, cần chủ động hơn trong việc làm bài tập.',
                'Có nền tảng khá, nếu cố gắng thêm sẽ đạt kết quả cao hơn.',
            ],
        },
    },
    {
        min: 5.0,
        info: {
            level: 'above_avg',
            label: 'Trung bình khá',
            comments: [
                'Nắm được kiến thức ở mức cơ bản, cần tập trung hơn trong giờ học.',
                'Hiểu bài ở mức trung bình, cần ôn tập thường xuyên để cải thiện.',
                'Kết quả chấp nhận được, nhưng cần nỗ lực nhiều hơn để tiến bộ.',
            ],
        },
    },
    {
        min: 4.0,
        info: {
            level: 'average',
            label: 'Trung bình',
            comments: [
                'Kiến thức cơ bản còn chưa vững, cần ôn lại bài cũ và làm bài tập đều đặn.',
                'Chưa nắm hết nội dung bài học, cần sự hỗ trợ thêm từ thầy cô và gia đình.',
                'Kết quả chưa đạt yêu cầu, cần cải thiện phương pháp học tập.',
            ],
        },
    },
    {
        min: 3.0,
        info: {
            level: 'below_avg',
            label: 'Yếu',
            comments: [
                'Kiến thức cơ bản còn yếu, thiếu tập trung trong giờ học. Cần phụ huynh phối hợp đôn đốc.',
                'Chưa hiểu bài, thường xuyên không hoàn thành bài tập. Cần được kèm cặp thêm.',
                'Kết quả chưa tốt, cần xem lại cách học và dành thời gian ôn bài nhiều hơn.',
            ],
        },
    },
    {
        min: 2.0,
        info: {
            level: 'weak',
            label: 'Kém',
            comments: [
                'Kiến thức cơ bản rất yếu, thiếu tập trung, cần cố gắng rất nhiều. Phụ huynh cần quan tâm sát sao.',
                'Chưa tiếp thu được bài, cần được hỗ trợ đặc biệt và ôn lại từ đầu.',
                'Kết quả rất thấp, cần phương pháp học tập mới và sự đồng hành của phụ huynh.',
            ],
        },
    },
    {
        min: 0,
        info: {
            level: 'very_weak',
            label: 'Rất kém',
            comments: [
                'Kiến thức nền tảng chưa có, cần bắt đầu lại từ cơ bản. Phụ huynh cần phối hợp chặt chẽ với trung tâm.',
                'Chưa nắm được kiến thức tối thiểu, cần chương trình ôn tập đặc biệt.',
                'Cần được kèm riêng để bù đắp kiến thức. Phụ huynh vui lòng liên hệ trung tâm để trao đổi thêm.',
            ],
        },
    },
];

function classifyScore(score: number): LevelInfo {
    for (const band of SCORE_BANDS) {
        if (score >= band.min) return band.info;
    }
    return SCORE_BANDS[SCORE_BANDS.length - 1].info; // fallback
}

/** Pick a deterministic-but-varied comment based on score */
function pickComment(comments: string[], score: number): string {
    // Use the decimal part of the score to pick a variant — feels random but is deterministic
    const index = Math.round(score * 10) % comments.length;
    return comments[index];
}

// ===== Trend Analysis =====
function analyzeTrend(currentAvg: number, previousAvg: number | null): { trend: ScoreTrend; delta: number } {
    if (previousAvg === null) {
        return { trend: 'new', delta: 0 };
    }
    const delta = currentAvg - previousAvg;
    if (delta >= 0.5) return { trend: 'up', delta };
    if (delta <= -0.5) return { trend: 'down', delta };
    return { trend: 'stable', delta };
}

// ===== Stability Analysis =====
function analyzeStability(scores: number[]): 'stable' | 'moderate' | 'unstable' {
    if (scores.length <= 1) return 'stable';
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev <= 0.5) return 'stable';
    if (stdDev <= 1.5) return 'moderate';
    return 'unstable';
}

// ===== Trend Comments — contextual based on both level and direction =====

function buildTrendComment(trend: ScoreTrend, delta: number, currentLevel: ScoreLevel, prevLevel: ScoreLevel | null): string {
    const absDelta = Math.abs(delta).toFixed(1);
    
    switch (trend) {
        case 'up': {
            // Big jump
            if (delta >= 3.0) {
                return ` Tiến bộ vượt bậc so với tháng trước (+${absDelta} điểm)! Rất đáng khen, hãy duy trì phong độ này.`;
            }
            if (delta >= 2.0) {
                return ` Tiến bộ rõ rệt so với tháng trước (+${absDelta} điểm), rất đáng khen!`;
            }
            // Contextual: was weak, now better
            if (prevLevel && ['very_weak', 'weak', 'below_avg'].includes(prevLevel) && ['above_avg', 'good', 'excellent', 'outstanding'].includes(currentLevel)) {
                return ` Có bước tiến đáng khích lệ (+${absDelta} điểm), cho thấy sự cố gắng lớn. Hãy tiếp tục phát huy!`;
            }
            return ` Có tiến bộ so với tháng trước (+${absDelta} điểm), tiếp tục cố gắng nhé!`;
        }
        case 'down': {
            if (delta <= -3.0) {
                return ` Sa sút đáng lo ngại so với tháng trước (-${absDelta} điểm). Phụ huynh cần trao đổi với con và trung tâm để tìm nguyên nhân.`;
            }
            if (delta <= -2.0) {
                return ` Có dấu hiệu sa sút rõ rệt (-${absDelta} điểm), cần quan tâm sát sao hơn.`;
            }
            // Was good, now just slightly down
            if (prevLevel && ['outstanding', 'excellent', 'good'].includes(prevLevel)) {
                return ` Có giảm nhẹ so với tháng trước (-${absDelta} điểm), cần lấy lại phong độ.`;
            }
            return ` Có giảm so với tháng trước (-${absDelta} điểm), cần cố gắng thêm.`;
        }
        case 'stable': {
            if (['outstanding', 'excellent'].includes(currentLevel)) {
                return ' Duy trì phong độ tốt, rất ổn định!';
            }
            if (['good', 'above_avg'].includes(currentLevel)) {
                return ' Kết quả ổn định, cần cố gắng thêm để vươn lên.';
            }
            return ' Kết quả chưa có cải thiện so với tháng trước, cần nỗ lực hơn.';
        }
        case 'new':
            return '';
    }
}

function buildStabilityComment(stability: 'stable' | 'moderate' | 'unstable'): string {
    switch (stability) {
        case 'stable': return '';
        case 'moderate': return ' Kết quả chưa thật đều, cần duy trì sự tập trung.';
        case 'unstable': return ' Điểm dao động nhiều giữa các lần kiểm tra, cho thấy con chưa ổn định. Cần theo dõi sát.';
    }
}

// ===== Main Function =====

/**
 * Generate an automatic Vietnamese comment for a student's performance.
 * Uses 8 detailed score bands on a /10 scale with contextual trend analysis.
 * 
 * @param currentScores - Array of scores in the current month (0-10)
 * @param history - Past monthly averages (sorted oldest → newest). If empty, trend = 'new'.
 * @returns AutoCommentResult with comment string and analysis metadata
 * 
 * @example
 * // Score 1.5, no history
 * generateAutoComment([1.5], [])
 * // → "Con đạt 1.5 điểm (Rất kém). Kiến thức nền tảng chưa có, cần bắt đầu lại từ cơ bản..."
 * 
 * // Score 3.0, last month was 1.5
 * generateAutoComment([3.0], [{ month: '2026-09', avgScore: 1.5 }])
 * // → "Con đạt 3.0 điểm (Yếu). Kiến thức cơ bản còn yếu... Có bước tiến đáng khích lệ (+1.5 điểm)..."
 * 
 * // Score 9.2, last month 8.8
 * generateAutoComment([9.2], [{ month: '2026-09', avgScore: 8.8 }])
 * // → "Con đạt 9.2 điểm (Xuất sắc). Nắm vững kiến thức... Duy trì phong độ tốt, rất ổn định!"
 */
export function generateAutoComment(
    currentScores: number[],
    history: ScoreHistory[] = []
): AutoCommentResult {
    if (currentScores.length === 0) {
        return {
            comment: 'Chưa có điểm để đánh giá.',
            level: 'average',
            levelLabel: 'Trung bình',
            trend: 'new',
            trendDelta: 0,
        };
    }

    // Calculate current average
    const currentAvg = currentScores.reduce((a, b) => a + b, 0) / currentScores.length;
    
    // Classify current
    const levelInfo = classifyScore(currentAvg);
    
    // Trend: compare with most recent history entry
    const sortedHistory = [...history].sort((a, b) => a.month.localeCompare(b.month));
    const previousAvg = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].avgScore : null;
    const prevLevelInfo = previousAvg !== null ? classifyScore(previousAvg) : null;
    const { trend, delta } = analyzeTrend(currentAvg, previousAvg);
    
    // Stability within current month
    const stability = analyzeStability(currentScores);
    
    // Build final comment
    const baseComment = pickComment(levelInfo.comments, currentAvg);
    let comment = `Con đạt ${currentAvg.toFixed(1)} điểm (${levelInfo.label}). ${baseComment}`;
    comment += buildTrendComment(trend, delta, levelInfo.level, prevLevelInfo?.level || null);
    comment += buildStabilityComment(stability);
    
    return {
        comment: comment.trim(),
        level: levelInfo.level,
        levelLabel: levelInfo.label,
        trend,
        trendDelta: delta,
    };
}

/**
 * Helper: Calculate average score from an array of numbers.
 * Returns null if array is empty.
 */
export function calculateAvgScore(scores: number[]): number | null {
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Helper: Aggregate progress reports for a student into a summary.
 * Used by both frontend preview and backend send logic to avoid DRY violation.
 */
export function aggregateStudentScores(reports: { score: number | null; comments: string }[]): {
    scores: number[];
    comments: string[];
    avgScore: string;
    scoreList: string;
    commentsText: string;
} {
    const scores: number[] = [];
    const comments: string[] = [];
    
    for (const r of reports) {
        if (r.score !== null && r.score !== undefined) {
            scores.push(r.score);
        }
        if (r.comments && r.comments.trim()) {
            comments.push(r.comments.trim());
        }
    }
    
    const avgScore = scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : 'N/A';
    
    const scoreList = scores.length > 0
        ? scores.map((s, i) => `Lần ${i + 1}: ${s}`).join(', ')
        : 'Chưa có điểm';
    
    const commentsText = comments.length > 0
        ? comments.join('; ')
        : 'Không có nhận xét';
    
    return { scores, comments, avgScore, scoreList, commentsText };
}
