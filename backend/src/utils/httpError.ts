export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class VersionConflictError extends HttpError {
  constructor(message: string, public readonly currentVersion: number) {
    super(409, message);
    this.name = 'VersionConflictError';
  }
}

export const AUTH_REQUIRED = 'Yêu cầu đăng nhập hoặc phiên làm việc hợp lệ.';
export const TRIP_ACCESS_DENIED = 'Bạn không có quyền truy cập chuyến đi này.';
export const INVALID_INVITE = 'Mã mời không tồn tại, đã hết hạn hoặc đã được sử dụng.';
