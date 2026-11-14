import MineralPricesBoard, {
  type MineralPricesBoardProps,
} from './MineralPricesBoard';

export type IndicativeMineralPricesProps = MineralPricesBoardProps;

export default function IndicativeMineralPrices(
  props: IndicativeMineralPricesProps
) {
  return <MineralPricesBoard {...props} />;
}
