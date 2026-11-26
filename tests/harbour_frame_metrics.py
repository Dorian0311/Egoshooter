import math


def distribution(values):
    ordered = sorted(values)
    return dict(mean=round(sum(ordered) / len(ordered), 2),
                p95=round(ordered[math.ceil(len(ordered) * .95) - 1], 2),
                worst=round(ordered[-1], 2))


def moving_frames(frames, ranges):
    intervals = []
    for first, end in ranges:
        assert 0 <= first < end <= len(frames), (first, end, len(frames))
        # frameMs is the interval *before* this render. The CPU/draws that
        # could have delayed its RAF belong to the preceding render.
        intervals.extend((frames[i]['frameMs'], frames[i-1]) for i in range(max(first, 1), end))
    assert intervals, 'No rendered frames during mouse turns'
    times = [ms for ms, _ in intervals]
    result = dict(frames=len(times), fps=round(1000 * len(times) / sum(times), 1),
                  frameMs=distribution(times))
    for shadow, key in [(True, 'shadowUpdate'), (False, 'withoutShadowUpdate')]:
        group = [(ms, previous) for ms, previous in intervals if previous['shadowUpdated'] == shadow]
        result[key] = dict(frames=len(group))
        if group:
            result[key].update(nextFrameMs=distribution(ms for ms, _ in group),
                               renderCpuMs=distribution(f['cpuMs'] for _, f in group),
                               drawCalls=distribution(f['calls'] for _, f in group))
    return result
