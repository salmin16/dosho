import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logActivity } from '@/utils/audit-logger';
import { INITIAL_MINERAL_PRICES } from '@/data/mineralPrices';
import type { MineralPriceRecord } from '@/types/database';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute server-side cache

interface MineralCacheEntry {
  data: MineralPriceRecord[];
  timestamp: number;
}

let cachedMineralPrices: MineralCacheEntry | null = null;

/**
 * GET /api/mineral-prices
 * Queries `public.mineral_prices`, applies lightweight caching and optional currency conversion,
 * and falls back gracefully to static LBMA/LME benchmarks if the database table is not yet migrated.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const currency = (searchParams.get('currency') || 'USD').toUpperCase();
  const rateParam = Number(searchParams.get('rate') || '1');
  const multiplier = Number.isFinite(rateParam) && rateParam > 0 ? rateParam : 1;

  const now = Date.now();

  if (cachedMineralPrices && now - cachedMineralPrices.timestamp < CACHE_TTL_MS) {
    const converted = cachedMineralPrices.data.map((m) => ({
      ...m,
      currency,
      converted_world_price: Number((m.world_market_price_usd * multiplier).toFixed(2)),
      converted_local_price: Number((m.local_market_price_usd * multiplier).toFixed(2)),
      converted_buying_centre_price: Number(
        (m.buying_centre_price_usd * multiplier).toFixed(2)
      ),
    }));

    return NextResponse.json(
      {
        source: 'cache',
        currency,
        multiplier,
        minerals: converted,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('mineral_prices')
      .select('*')
      .order('mineral_name', { ascending: true });

    const records: MineralPriceRecord[] =
      !error && data && data.length > 0
        ? (data as MineralPriceRecord[])
        : INITIAL_MINERAL_PRICES;

    cachedMineralPrices = {
      data: records,
      timestamp: now,
    };

    const converted = records.map((m) => ({
      ...m,
      currency,
      converted_world_price: Number((m.world_market_price_usd * multiplier).toFixed(2)),
      converted_local_price: Number((m.local_market_price_usd * multiplier).toFixed(2)),
      converted_buying_centre_price: Number(
        (m.buying_centre_price_usd * multiplier).toFixed(2)
      ),
    }));

    return NextResponse.json(
      {
        source: !error && data && data.length > 0 ? 'database' : 'fallback',
        currency,
        multiplier,
        minerals: converted,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch {
    return NextResponse.json({
      source: 'fallback',
      currency,
      multiplier,
      minerals: INITIAL_MINERAL_PRICES,
    });
  }
}

/**
 * PATCH /api/mineral-prices
 * Protected Admin endpoint (`public.is_admin()`) to update commodity benchmark prices
 * and record an audit trail entry.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required.' },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, role, status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
    logActivity({
      userId: user.id,
      action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
      req: request,
      metadata: { endpoint: 'PATCH /api/mineral-prices' },
    });
    return NextResponse.json(
      { error: 'Forbidden: Administrative clearance required.' },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      world_market_price_usd?: number;
      local_market_price_usd?: number;
      buying_centre_price_usd?: number;
      trend_percentage?: number;
    };

    if (
      !body.id ||
      typeof body.world_market_price_usd !== 'number' ||
      typeof body.local_market_price_usd !== 'number' ||
      typeof body.buying_centre_price_usd !== 'number'
    ) {
      return NextResponse.json(
        { error: 'id and numeric benchmark prices are required.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('mineral_prices')
      .update({
        world_market_price_usd: body.world_market_price_usd,
        local_market_price_usd: body.local_market_price_usd,
        buying_centre_price_usd: body.buying_centre_price_usd,
        trend_percentage: body.trend_percentage ?? 0,
        updated_at: nowIso,
      })
      .eq('id', body.id)
      .select('*')
      .single();

    // Invalidate server cache
    cachedMineralPrices = null;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logActivity({
      userId: user.id,
      action: 'ADMIN_UPDATE_MINERAL_PRICE',
      req: request,
      metadata: {
        mineralId: body.id,
        worldMarketUsd: body.world_market_price_usd,
        localMarketUsd: body.local_market_price_usd,
        buyingCentreUsd: body.buying_centre_price_usd,
        trendPercentage: body.trend_percentage,
      },
    });

    return NextResponse.json({ mineral: updated });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request payload.' },
      { status: 400 }
    );
  }
}
