import { useEffect, useState } from 'react';
import { voucherApi } from '../api/services';

let cache = null;

/** Departments / categories / statuses from the API (cached for the session). */
export default function useMeta() {
  const [meta, setMeta] = useState(cache || { departments: [], categories: [], statuses: [] });

  useEffect(() => {
    if (cache) return;
    voucherApi
      .meta()
      .then((res) => {
        cache = res.data;
        setMeta(res.data);
      })
      .catch(() => {});
  }, []);

  return meta;
}
