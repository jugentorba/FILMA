import React, { useEffect } from 'react';
import { PlayerModalNuvio } from './PlayerModalNuvio';

type Props = React.ComponentProps<typeof PlayerModalNuvio>;

export function PlayerModal(props: Props) {
  useEffect(() => {
    if (props.progress?.item) return;
    props.onProgress(
      props.progress?.positionSeconds ?? 0,
      props.progress?.durationSeconds ?? props.item.durationSeconds ?? 0,
    );
  }, [props.item.durationSeconds, props.onProgress, props.progress]);

  return <PlayerModalNuvio {...props} />;
}
