<script lang="ts">
  const backWall = {
    left: 360,
    top: 150,
    right: 1240,
    bottom: 820,
  };

  const outerRoom = {
    left: -120,
    top: -48,
    right: 1720,
    bottom: 1048,
  };

  const backVerticals = Array.from({ length: 9 }, (_, index) => {
    const x = backWall.left + ((index + 1) * (backWall.right - backWall.left)) / 10;
    return { x };
  });

  const backHorizontals = Array.from({ length: 7 }, (_, index) => {
    const ratio = (index + 1) / 8;
    const y = backWall.top + ratio * (backWall.bottom - backWall.top);
    return { y, ratio };
  });

  const depthSteps = [0.18, 0.33, 0.48, 0.62, 0.76, 0.89];
  const gridColumns = Array.from({ length: 11 }, (_, index) => {
    const ratio = index / 10;
    return {
      ratio,
      backX: backWall.left + ratio * (backWall.right - backWall.left),
      outerX: outerRoom.left + ratio * (outerRoom.right - outerRoom.left),
    };
  });

  const sideRows = backHorizontals.map(({ ratio }) => {
    return {
      leftY: backWall.top + ratio * (backWall.bottom - backWall.top),
      outerY: outerRoom.top + ratio * (outerRoom.bottom - outerRoom.top),
    };
  });
</script>

<div class="hero-perspective-grid" aria-hidden="true">
  <svg
    class="hero-perspective-grid__svg"
    viewBox="0 0 1600 1000"
    preserveAspectRatio="none"
    focusable="false"
  >
    <g class="hero-perspective-grid__faces">
      <polygon
        points="{outerRoom.left},{outerRoom.top} {outerRoom.right},{outerRoom.top} {backWall.right},{backWall.top} {backWall.left},{backWall.top}"
      />
      <polygon
        points="{outerRoom.left},{outerRoom.bottom} {backWall.left},{backWall.bottom} {backWall.right},{backWall.bottom} {outerRoom.right},{outerRoom.bottom}"
      />
      <polygon
        points="{outerRoom.left},{outerRoom.top} {backWall.left},{backWall.top} {backWall.left},{backWall.bottom} {outerRoom.left},{outerRoom.bottom}"
      />
      <polygon
        points="{backWall.right},{backWall.top} {outerRoom.right},{outerRoom.top} {outerRoom.right},{outerRoom.bottom} {backWall.right},{backWall.bottom}"
      />
    </g>

    <defs>
      <g id="hero-grid-soft-lines">
        {#each backVerticals as line}
          <line x1={line.x} y1={backWall.top} x2={line.x} y2={backWall.bottom} />
        {/each}

        {#each backHorizontals as line}
          <line x1={backWall.left} y1={line.y} x2={backWall.right} y2={line.y} />
        {/each}
      </g>

      <g id="hero-grid-main-lines">
        <rect
          x={backWall.left}
          y={backWall.top}
          width={backWall.right - backWall.left}
          height={backWall.bottom - backWall.top}
        />

        <line x1={outerRoom.left} y1={outerRoom.top} x2={backWall.left} y2={backWall.top} />
        <line x1={outerRoom.right} y1={outerRoom.top} x2={backWall.right} y2={backWall.top} />
        <line x1={outerRoom.left} y1={outerRoom.bottom} x2={backWall.left} y2={backWall.bottom} />
        <line x1={outerRoom.right} y1={outerRoom.bottom} x2={backWall.right} y2={backWall.bottom} />

        {#each depthSteps as step}
          <line
            x1={outerRoom.left + step * (backWall.left - outerRoom.left)}
            y1={outerRoom.top + step * (backWall.top - outerRoom.top)}
            x2={outerRoom.right + step * (backWall.right - outerRoom.right)}
            y2={outerRoom.top + step * (backWall.top - outerRoom.top)}
          />
          <line
            x1={outerRoom.left + step * (backWall.left - outerRoom.left)}
            y1={outerRoom.bottom + step * (backWall.bottom - outerRoom.bottom)}
            x2={outerRoom.right + step * (backWall.right - outerRoom.right)}
            y2={outerRoom.bottom + step * (backWall.bottom - outerRoom.bottom)}
          />
        {/each}

        {#each gridColumns as line}
          <line x1={line.outerX} y1={outerRoom.top} x2={line.backX} y2={backWall.top} />
          <line x1={line.outerX} y1={outerRoom.bottom} x2={line.backX} y2={backWall.bottom} />
        {/each}

        {#each gridColumns.slice(1, -1) as column}
          <line
            x1={outerRoom.left + column.ratio * (backWall.left - outerRoom.left)}
            y1={outerRoom.top + column.ratio * (backWall.top - outerRoom.top)}
            x2={outerRoom.left + column.ratio * (backWall.left - outerRoom.left)}
            y2={outerRoom.bottom + column.ratio * (backWall.bottom - outerRoom.bottom)}
          />
          <line
            x1={outerRoom.right + column.ratio * (backWall.right - outerRoom.right)}
            y1={outerRoom.top + column.ratio * (backWall.top - outerRoom.top)}
            x2={outerRoom.right + column.ratio * (backWall.right - outerRoom.right)}
            y2={outerRoom.bottom + column.ratio * (backWall.bottom - outerRoom.bottom)}
          />
        {/each}

        {#each sideRows as line}
          <line x1={outerRoom.left} y1={line.outerY} x2={backWall.left} y2={line.leftY} />
          <line x1={backWall.right} y1={line.leftY} x2={outerRoom.right} y2={line.outerY} />
        {/each}
      </g>
    </defs>

    <use href="#hero-grid-soft-lines" class="hero-perspective-grid__line hero-perspective-grid__line--soft" />
    <use href="#hero-grid-main-lines" class="hero-perspective-grid__line" />
  </svg>
</div>
