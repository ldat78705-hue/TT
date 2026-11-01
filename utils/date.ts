export const formatVietnamDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    
    // If it's a full ISO string with timezone, let Date handle it
    if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }

    // If it's a local string without timezone (e.g. YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    // we assume it's already in Vietnam time.
    let normalized = dateString;
    if (normalized.length === 10) {
        normalized += 'T00:00:00';
    }
    
    // Parse manually to avoid any browser timezone shifting
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
        const [_, year, month, day, hour, minute, second] = match;
        return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
    }

    return dateString;
};

export const getVietnamTime = () => {
    const now = new Date();
    const vnTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const year = vnTime.getFullYear();
    const month = String(vnTime.getMonth() + 1).padStart(2, '0');
    const day = String(vnTime.getDate()).padStart(2, '0');
    const hours = String(vnTime.getHours()).padStart(2, '0');
    const minutes = String(vnTime.getMinutes()).padStart(2, '0');
    const seconds = String(vnTime.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};
