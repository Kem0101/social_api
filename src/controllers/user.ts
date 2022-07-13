'use strict';

import bcrypt from 'bcrypt-nodejs';
import 'mongoose-pagination';
import fs from 'fs';
import path = require('path');

import User from '../models/user';
import Follow from '../models/follow';
import Publication from '../models/publication';

import generateJWT from '../helpers/generateJWT';
import generateId from '../helpers/generateId';
import emailRegister from '../helpers/emailRegister';
import emailOlvidePassword from '../helpers/emailForgotPassword';

// METODO PARA REGISTRAR USUARIO
async function saveUser(req: any, res: any) {
  const { username, email, fullname } = req.body;

  // Prevenir usuarios duplicados
  const existUser = await User.findOne({ username });
  const existEmail = await User.findOne({ email });
  if (existUser) {
    const error = new Error('Usuario no disponible');
    return res.json({ msg: error.message });
  }
  if (existEmail) {
    const error = new Error('Email no disponible');
    return res.json({ msg: error.message });
  }

  try {
    // Guardar nuevo usuario
    const user = new User(req.body);
    const userSaved: any = await user.save();

    // Enviar email de confirmación
    emailRegister({
      email,
      fullname,
      token: userSaved.token,
    });

    return res.json(userSaved);
  } catch (error) {
    console.log(error);
  }
}

// METODO PARA CONFIRMAR CUENTA DE USUARIO
async function userConfirm(req: any, res: any) {
  const { token } = req.params;

  const confirm = await User.findOne({ token });
  if (!confirm) {
    const error = new Error('Token no valido');
    return res.json({ msg: error.message });
  }
  console.log(confirm);
  try {
    (confirm.token = null), (confirm.confirmed = true);
    await confirm.save();

    res.json({ msg: 'Usuario confirmado correctamente' });
  } catch (error) {
    console.log(error);
  }
}

// // METODO PARA LOGUEAR UN USUARIO
async function userLogin(req: any, res: any) {
  // Destructurar
  const { email, password } = req.body;

  // Verificar si el usuario existe
  const existUser = await User.findOne({ email });
  if (!existUser) {
    const error = new Error('El usuario no existe');
    return res.json({ msg: error.message });
  }
  // Comprobar si el usuario esta confirmado
  if (!existUser.confirmed) {
    const error = new Error('Tu cuenta no ha sido confirmada');
    return res.json({ msg: error.message });
  }
  // Revisar si el password es correcto
  if (await existUser.authenticate(password)) {
    // Autenticar el usuario
    res.json({
      _id: existUser._id,
      fullname: existUser.fullname,
      email: existUser.email,
      token: generateJWT(existUser.id),
    });
  } else {
    const error = new Error('El password es incorrecto');
    return res.json({ msg: error.message });
  }

  // return res.json({ msg: 'Usuario ready' });
}

// PERFIL DE USUARIO ESTE METODO ES LA PAGINA PRINCIPAL LUEGO QUE EL USUARIO SE HA AUTENTICADO
function homeUser(req: any, res: any) {
  const { user } = req;

  res.json({ user });
}

// METODO OLVIDE CONTRASEÑA
async function forgotPassword(req: any, res: any) {
  const { email } = req.body;

  const existUser = await User.findOne({ email });
  if (!existUser) {
    const error = new Error('El usuario no existe');
    return res.json({ msg: error.message });
  }

  try {
    existUser.token = generateId();
    await existUser.save();

    // Enviar email con instrucciones
    emailOlvidePassword({
      email,
      fullname: existUser.name,
      token: existUser.token,
    });

    res.json({
      msg: 'Hemos enviado un email con los pasos para cambiar la contraseña',
    });
  } catch (error) {
    console.log(error);
  }
}
// METODO COMPROBAR PASSWORD
async function checkToken(req: any, res: any) {
  const { token } = req.params;

  const validToken = await User.findOne({ token });
  if (validToken) {
    res.json({ msg: 'Token válido y el usuario existe' });
  } else {
    const error = new Error('Token no válido');
    return res.json({ msg: error.message });
  }
}
// METODO ASIGNAR EL NUEVO PASSWORD
async function newPassword(req: any, res: any) {
  const { token } = req.params;
  const { password } = req.body;

  const user = await User.findOne({ token });
  if (!user) {
    const error = new Error('Hubo un error');
    return res.json({ msg: error.message });
  }
  try {
    user.token = null;
    user.password = password;
    await user.save();
    res.json({ msg: 'Password modificado correctamente' });
  } catch (error) {
    console.log(error);
  }
}

// METODO PARA EXTRAER LOS DATOS DE UN USUARIO
// ESTE METODO DEBE SER REVISADO PORQUE AL DEVOLVER EL OBJETO DE LA PETICION ESTA DEVOLVIENDO EL
// OBJETO VALUE VACIO, DONDE DEBE DEVOLVER SI SIGUE Y ES SEGUIDO POR DICHO USUARIO
function getUser(req: any, res: any) {
  var userId = req.params.id;

  const user = User.findById(userId);
  if (!user) {
    const error = new Error('El usuario no existe');
    return res.json({ msg: error.message });
  }

  // Esta función me permite saber si estoy siguiendo a este usuario o no
  followThisUser(req.user, userId).then((value) => {
    user.password = undefined;
    return res.json({ user, value });
  });
}

async function followThisUser(identity_user_id: any, user_id: any) {
  try {
    var following = await Follow.findOne({
      user: identity_user_id,
      followed: user_id,
    })
      .exec()
      .then((following: any) => {
        console.log(following);
        return following;
      })
      .catch((err: any) => {
        return console.log(err);
      });
    var followed = await Follow.findOne({
      user: user_id,
      followed: identity_user_id,
    })
      .exec()
      .then((followed: any) => {
        console.log(followed);
        return followed;
      })
      .catch((err: any) => {
        return console.log(err);
      });
    return {
      following: following,
      followed: followed,
    };
  } catch (err) {
    console.log(err);
  }
}
// // METODO PARA DEVOLVER UN LISTADO DE USUARIOS PAGINADOS
function getUsers(req: any, res: any) {
  // Obtener el id del usuario logueado
  var identity_user_id = req.user;
  var page = 1;

  if (req.params.page) {
    page = req.params.page;
  }

  var itemsPerPage = 5;
  var total: number;

  const users = User.find().sort('_id').paginate(page, itemsPerPage);
  if (!users) {
    const error = new Error('No hay usuarios disponibles');
    return res.json({ msg: error.message });
  }

  followUserIds(identity_user_id).then((value) => {
    return res.json({
      users,
      user_following: value.following,
      user_followed_me: value.followed,
      total,
      pages: Math.ceil(total / itemsPerPage),
    });
  });
}

async function followUserIds(user_id: any) {
  var following = await Follow.find({ user: user_id })
    .select({ _id: 0, __v: 0, user: 0 })
    .exec()
    .then((following: any) => {
      return following;
    })
    .catch((err: any) => {
      return console.log(err);
    });

  var followed = await Follow.find({ followed: user_id })
    .select({ _id: 0, __v: 0, followed: 0 })
    .exec()
    .then((followed: any) => {
      return followed;
    })
    .catch((err: any) => {
      return console.log(err);
    });

  // Procesar following ids
  var following_clean: any[] = [];

  following.forEach((follow: any) => {
    following_clean.push(follow.followed);
  });

  // Procesar followed ids
  var followed_clean: any[] = [];

  followed.forEach((follow: any) => {
    followed_clean.push(follow.user);
  });

  return {
    following: following_clean,
    followed: followed_clean,
  };
}

// // METODO PARA CONTABILIZAR LOS USUARIOS QUE SIGO, LOS QUE ME SIGUEN Y LAS PUBLICACIONES
function getCounters(req: any, res: any) {
  var userId = req.user;
  if (req.params.id) {
    userId = req.params.id;
  }

  getCountFollow(userId).then((value) => {
    return res.json({ value });
  });
}

const getCountFollow = async (user_id: any) => {
  try {
    // Lo hice de dos formas. "following" con callback de countDocuments y "followed" con una promesa
    var following = await Follow.countDocuments({ user: user_id }).then(
      (count: any) => count
    );
    var followed = await Follow.countDocuments({ followed: user_id }).then(
      (count: any) => count
    );
    var publication = await Publication.countDocuments({ user: user_id }).then(
      (count: any) => count
    );

    return { following, followed, publication };
  } catch (error) {
    console.log(error);
  }
};

// // METODO PARA ACTUALIZAR LOS DATOS DE UN USUARIO
function updateUser(req: any, res: any) {
  // Capturar el id que viene por la url, del usuario que esta haciendo la petición
  const userId = req.params.id;
  // Capturar los datos que viene en el cuerpo de la petición, que son los que van para actualizar
  const update = req.body;

  //  Borrar el password que viene en la petición del usuario
  delete update.password;
  // Validar que el id del usuario que viene en la petición sea el mismo del usuario que hace la petición
  // solo el propio usuario puede actualizar sus datos
  if (userId != req.user) {
    const error = new Error('No tienes permiso para actualizar este usuario');
    return res.json({
      msg: error.message,
    });
  }

  const userUpdated = User.findByIdAndUpdate(userId, update, { new: true });
  if (!userUpdated) {
    const error = new Error('No se ha podido actualizar el usuario');
    return res.json({ msg: error.message });
  }

  try {
    return res.json({ user: userUpdated });
  } catch (error) {
    console.log(error);
  }
}

// // METODO PARA SUBIR ARCHIVOS DE IMAGEN/AVATAR DE UN USUARIO
function uploadImage(req: any, res: any) {
  // Capturar el id que viene por la url, del usuario que esta haciendo la petición
  var userId = req.params.id;

  if (req.files) {
    var filePath = req.files.image.path;
    var fileSplit = filePath.split('/');
    var fileName = fileSplit[2];
    var extSplit = fileName.split('.');
    var fileExt = extSplit[1];

    // Validar que el id del usuario que viene en la petición sea el mismo del usuario que hace la petición
    if (userId != req.user) {
      return removeFilesOFUploads(
        res,
        filePath,
        'No tiene permiso para actualizar los datos del usuario'
      );
    }

    if (
      fileExt == 'png' ||
      fileExt == 'jpg' ||
      fileExt == 'jpeg' ||
      fileExt == 'gif'
    ) {
      // Actualizar documentos de usuarios logueado
      const userUpdated = User.findByIdAndUpdate(
        userId,
        { image: fileName },
        { new: true }
      );
      if (!userUpdated) {
        const error = new Error('No se ha podido actualizar el usuario');
        return res.json({
          msg: error.message,
        });
      }

      try {
        return res.json({ user: userUpdated });
        console.log(userUpdated);
      } catch (error) {
        console.log(error);
      }
    } else {
      return removeFilesOFUploads(res, filePath, 'Extensión no valida');
    }
  } else {
    const error = new Error('No se ha subido la imagen');
    return res.json({ msg: error.message });
  }
}

function removeFilesOFUploads(res: any, filePath: any, message: string) {
  fs.unlink(filePath, (error: any) => {
    return res.json({ message });
  });
}

// METODO PARA DEVOLVER UNA IMAGEN
// PROBAR ESTE METODO LUEGO DE CORREGIR EL METODO UploadImage
function getImageFile(req: any, res: any) {
  var imageFile = req.params.imageFile;
  var pathFile = './uploads/users' + imageFile;

  fs.exists(pathFile, (exists: any) => {
    if (exists) {
      res.sendFile(path.resolve(pathFile));
    } else {
      res.json({ msg: 'No existe la imagen...' });
    }
  });
}

export default {
  saveUser,
  userConfirm,
  userLogin,
  homeUser,
  forgotPassword,
  checkToken,
  newPassword,
  getUser,
  getUsers,
  getCounters,
  updateUser,
  uploadImage,
  getImageFile,
};
