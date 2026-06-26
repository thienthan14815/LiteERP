export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function buildPagination(page = 1, pageSize = 20) {
  const take = Math.max(1, Math.min(pageSize, 200));
  const skip = (Math.max(1, page) - 1) * take;
  return { take, skip };
}

export function paginate<T>(items: T[], total: number, page = 1, pageSize = 20): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
