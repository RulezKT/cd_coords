const { find_eps } = require("cd_eps");
const { atn2_RAD_with_360_check, atn2_RAD_with_90_check } = require("cd_math");
const { PI } = require("cd_consts");

// conversion of equatorial to ecliptical cartesian coordinates
function equ_to_ecl(equ, sec_from_jd2000) {
  const eps = find_eps(sec_from_jd2000);
  const math_sin_eps = Math.sin(eps);
  const math_cos_eps = Math.cos(eps);

  const ecl = {};

  // переводим в эклиптические прямоугольные (декартовы координаты) из экваториальных
  ecl.x = equ.x;

  // pp[1] - координата y
  // pp[2] - координата z
  ecl.y = equ.y * math_cos_eps + equ.z * math_sin_eps;

  ecl.z = -equ.y * math_sin_eps + equ.z * math_cos_eps;

  // то же самое делаем для скорости
  ecl.velocity_x = equ.velocity_x;

  ecl.velocity_y =
    equ.velocity_y * Math.cos(eps) + equ.velocity_z * Math.sin(eps);

  ecl.velocity_z =
    -equ.velocity_y * Math.sin(eps) + equ.velocity_z * Math.cos(eps);

  //console.log(`eps = ${eps}`);
  //console.log(`from equ_to_ecl equ x = ${equ.x} y = ${equ.y} z = ${equ.z}`);
  //console.log(`from equ_to_ecl ecl x = ${ecl.x} y = ${ecl.y} z = ${ecl.z}`);
  return ecl;
}

/* conversion of cartesian (x[3]) to polar coordinates (l[3]).
 * x = l is allowed.
 * if |x| = 0, then lon, lat and rad := 0.
 */
function cart_to_polar(ecl) {
  const ecl_polar = {};

  // переводим в эклиптические полярные из эклиптических прямоугольных

  if (ecl.x == 0 && ecl.y == 0 && ecl.z == 0) {
    ecl_polar.longitude = ecl_polar.latitude = ecl_polar.radius = 0;
    return ecl_polar;
  }

  /*  calculate radius. */
  let r = ecl.x * ecl.x + ecl.y * ecl.y + ecl.z * ecl.z;
  r = Math.sqrt(r);

  // эклиптическая долгота phi in [0 deg, +360 deg]
  // здесь должен быть atn2(y, x);
  // polar[0] = zatan2( pp[0],y);
  const longt = atn2_RAD_with_360_check(ecl.y, ecl.x);

  // эклиптическая широта theta in [-90 deg, +90 deg]
  // здесь должен быть atn2(z, sqrt(x*x + y*y));
  // polar[1] = asin( z/r );

  let rxy = ecl.x * ecl.x + ecl.y * ecl.y;
  rxy = Math.sqrt(rxy);

  let lat = 0;
  if (rxy == 0) {
    if (ecl.z >= 0) lat = PI / 2;
    else lat = -(PI / 2);
  } else {
    lat = atn2_RAD_with_90_check(ecl.z, rxy);
  }

  ecl_polar.longitude = longt;
  ecl_polar.latitude = lat;
  ecl_polar.radius = r;

  return ecl_polar;
}

/*
 * conversion of position and speed.
 * from cartesian (x[6]) to polar coordinates (l[6]).
 * x = l is allowed.
 * if position is 0, function returns direction of
 * motion.
 */
function cart_to_polar_with_speed(ecl) {
  const ecl_polar = {};

  /* zero position */
  if (ecl.x == 0 && ecl.y == 0 && ecl.z == 0) {
    ecl_polar.longitude =
      ecl_polar.latitude =
      ecl_polar.velocity_x =
      ecl_polar.velocity_y =
        0;

    ecl_polar.velocity_z = Math.sqrt(
      ecl.velocity_x * ecl.velocity_x +
        ecl.velocity_y * ecl.velocity_y +
        ecl.velocity_z * ecl.velocity_z
    );

    // let temp_ecl = {x: ecl.velocity_x, y: ecl.velocity_y, z: ecl.velocity_z};
    const temp_polar = cart_to_polar({
      x: ecl.velocity_x,
      y: ecl.velocity_y,
      z: ecl.velocity_z,
    });
    ecl_polar.longitude = temp_polar.longitude;
    ecl_polar.latitude = temp_polar.latitude;
    ecl_polar.radius = 0;
    return ecl_polar;
  }

  /* zero speed */
  if (ecl.velocity_x == 0 && ecl.velocity_y == 0 && ecl.velocity_z == 0) {
    ecl_polar.velocity_x = ecl_polar.velocity_y = ecl_polar.velocity_z = 0;
    const temp_polar = cart_to_polar(ecl);
    ecl_polar.longitude = temp_polar.longitude;
    ecl_polar.latitude = temp_polar.latitude;
    ecl_polar.radius = temp_polar.radius;
    return ecl_polar;
  }

  /* position */

  /*  calculate radius. */
  let r = ecl.x * ecl.x + ecl.y * ecl.y + ecl.z * ecl.z;
  r = Math.sqrt(r);

  // эклиптическая долгота phi in [0 deg, +360 deg]
  // здесь должен быть atn2(y, x);
  // polar[0] = zatan2( pp[0],y);
  const longt = atn2_RAD_with_360_check(ecl.y, ecl.x);

  // эклиптическая широта theta in [-90 deg, +90 deg]
  // здесь должен быть atn2(z, sqrt(x*x + y*y));
  // polar[1] = asin( z/r );

  let rxy = ecl.x * ecl.x + ecl.y * ecl.y;
  rxy = Math.sqrt(rxy);

  let lat = 0;
  if (rxy == 0) {
    if (ecl.z >= 0) lat = PI / 2;
    else lat = -(PI / 2);
  } else {
    lat = atn2_RAD_with_90_check(ecl.z, rxy);
  }

  /* speed:
   * 1. rotate coordinate system by longitude of position about z-axis,
   *    so that new x-axis = position radius projected onto x-y-plane.
   *    in the new coordinate system
   *    vy'/r = dlong/dt, where r = sqrt(x^2 +y^2).
   * 2. rotate coordinate system by latitude about new y-axis.
   *    vz"/r = dlat/dt, where r = position radius.
   *    vx" = dr/dt
   */
  const coslon = ecl.x / rxy;
  /* cos(l[0]); */
  const sinlon = ecl.y / rxy;
  /* sin(l[0]); */
  const coslat = rxy / r;
  /* cos(l[1]); */
  const sinlat = ecl.z / r;
  /* sin(ll[1]); */

  const xx3 = ecl.velocity_x * coslon + ecl.velocity_y * sinlon;
  let xx4 = -ecl.velocity_x * sinlon + ecl.velocity_y * coslon;
  ecl_polar.velocity_x = xx4 / rxy;
  /* speed in longitude */
  xx4 = -sinlat * xx3 + coslat * ecl.velocity_z;
  const xx5 = coslat * xx3 + sinlat * ecl.velocity_z;

  ecl_polar.velocity_y = xx4 / r;
  /* speed in latitude */
  ecl_polar.velocity_z = xx5;
  /* speed in radius */
  ecl_polar.longitude = longt;
  /* return position */
  ecl_polar.latitude = lat;
  ecl_polar.radius = r;

  /*
    console.log(`ecl = ${ecl.x} ${ecl.y} ${ecl.z}`);
    console.log(
      `ecl_polar = ${ecl_polar.longitude} ${ecl_polar.latitude} ${
        ecl_polar.radius
      }`
    );
    */
  return ecl_polar;
}

// conversion of equatorial to ecliptical cartesian coordinates
function equ_to_ecl_experimental(equ, sec_from_jd2000) {
  // cos = from 1 to PI/6 (0.5235987755982988) (0 to 30 degrees)
  // sin = from 0 to 1/2 (0.5) (0 to 30 degrees)

  const eps_0_sec = 0.4090926006005825565914;
  const eps_in_1_sec = -0.0000000000000719475504;

  const eps = eps_0_sec + sec_from_jd2000 * eps_in_1_sec;
  const math_sin_eps = Math.sin(eps);
  const math_cos_eps = Math.cos(eps);

  const ecl = {};

  // переводим в эклиптические прямоугольные (декартовы координаты) из экваториальных
  ecl.x = equ.x;

  // pp[1] - координата y
  // pp[2] - координата z
  ecl.y = equ.y * math_cos_eps + equ.z * math_sin_eps;

  ecl.z = -equ.y * math_sin_eps + equ.z * math_cos_eps;

  // то же самое делаем для скорости
  ecl.velocity_x = equ.velocity_x;

  ecl.velocity_y =
    equ.velocity_y * Math.cos(eps) + equ.velocity_z * Math.sin(eps);

  ecl.velocity_z =
    -equ.velocity_y * Math.sin(eps) + equ.velocity_z * Math.cos(eps);

  //console.log(`eps = ${eps}`);
  //console.log(`from equ_to_ecl equ x = ${equ.x} y = ${equ.y} z = ${equ.z}`);
  //console.log(`from equ_to_ecl ecl x = ${ecl.x} y = ${ecl.y} z = ${ecl.z}`);
  return ecl;
}

module.exports = {
  equ_to_ecl,
  cart_to_polar,
  cart_to_polar_with_speed,
};
