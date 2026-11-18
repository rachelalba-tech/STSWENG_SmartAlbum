/* Place inside each album card actions area */
                      <IconButton label="Delete album" danger onClick={() => {
                        if (!window.confirm(`Delete "${album.name}"? Photos will remain in your photo library.`)) return
                        void onAlbumDelete(album.id).catch(() => setActionError("Could not delete the album. Please try again."))
                      }}>
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
