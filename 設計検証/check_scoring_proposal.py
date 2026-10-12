"""採点案の数値関係だけを確認する。アプリ・経路探索の実装ではない。"""

from fractions import Fraction


def time_score(best_time, arrival_time):
    return 50 + 50 * best_time / arrival_time


def fault_score(best_worst_time, arrivals):
    # この数値確認は、独立故障ケースが一つ以上ある課題を対象とする。
    # ケースなしの扱いはこの関数で勝手に定義しない。
    if not arrivals:
        raise ValueError("故障ケースがない場合は、この確認式の対象外")
    if any(arrival is None for arrival in arrivals):
        return Fraction(0)
    return time_score(best_worst_time, max(arrivals))


def combined_score(best_time, best_hops, time_unit, hop_bound, time, hops):
    # 採点専用の補正。実験の時計・到達記録へは適用しない。
    correction_unit = time_unit / (2 * hop_bound)
    scoring_value = time + correction_unit * (hops - best_hops)
    return 50 + 50 * best_time / scoring_value


def verify():
    assert time_score(Fraction(2), Fraction(4)) == 75
    assert time_score(Fraction(2), Fraction(2)) == 100
    counts = {"range_checks": 0, "hop_order_checks": 0, "time_order_checks": 0}
    best_time = Fraction(5)

    for time_unit in (Fraction(1), Fraction(1, 10), Fraction(1, 100)):
        for hop_bound in (1, 2, 5, 20):
            best_hops = min(2, hop_bound)
            for time_step in range(11):
                arrival_time = best_time + time_step * time_unit
                first_hop = best_hops if time_step == 0 else 1
                scores = []
                for hops in range(first_hop, hop_bound + 1):
                    result = combined_score(
                        best_time, best_hops, time_unit, hop_bound, arrival_time, hops
                    )
                    assert 50 < result <= 100
                    assert (result == 100) == (
                        arrival_time == best_time and hops == best_hops
                    )
                    scores.append(result)
                    counts["range_checks"] += 1
                for better, worse in zip(scores, scores[1:]):
                    assert better > worse
                    counts["hop_order_checks"] += 1
                if time_step < 10:
                    slowest_hops_at_this_time = combined_score(
                        best_time, best_hops, time_unit, hop_bound,
                        arrival_time, hop_bound
                    )
                    fewest_hops_at_next_time = combined_score(
                        best_time, best_hops, time_unit, hop_bound,
                        arrival_time + time_unit, 1
                    )
                    assert slowest_hops_at_this_time > fewest_hops_at_next_time
                    counts["time_order_checks"] += 1

    score = lambda time, hops: combined_score(
        Fraction(5), 2, Fraction(1, 10), 5, Fraction(time), hops
    )
    # 同じ時間・本数を持つ別経路に、経路ID由来の点差を付けない。
    equally_best_routes = {"route-A": score("5", 2), "route-B": score("5", 2)}
    assert equally_best_routes["route-A"] == equally_best_routes["route-B"] == 100
    counts["equal_best_route_checks"] = 1
    # 表示を丸めてから比較すると評価差が失われる例。
    close_score = combined_score(Fraction(5), 2, Fraction(1, 100), 5, Fraction(5), 3)
    assert close_score < 100
    assert round(float(close_score), 1) == 100.0
    counts["rounding_collision_checks"] = 1

    fault_cases = (
        ((2, 2, 8), Fraction(75)),
        ((4, 4, 5), Fraction(90)),
        ((4, 4, 4), Fraction(100)),
        ((4, None, 8), Fraction(0)),
        ((None, None, None), Fraction(0)),
        ((4, 8, 8), Fraction(75)),
    )
    fault_results = []
    for times, expected in fault_cases:
        arrivals = tuple(None if value is None else Fraction(value) for value in times)
        result = fault_score(Fraction(4), arrivals)
        assert result == expected
        fault_results.append(result)
    assert fault_results[1] > fault_results[0]
    assert fault_results[5] == fault_results[0]
    counts["fault_score_checks"] = len(fault_cases) + 2

    print("PASS:", ", ".join(f"{key}={value}" for key, value in counts.items()))
    for time, hops in (("5", 2), ("5", 3), ("5.1", 1), ("6", 1)):
        result = score(time, hops)
        print(f"example: time={time}, hops={hops}, score={float(result):.4f}, exact={result}")
    print("rounding example:", f"exact_score={float(close_score):.6f}", "one_decimal=100.0")


if __name__ == "__main__":
    verify()
